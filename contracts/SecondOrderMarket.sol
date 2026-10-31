// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {JSONParserLib} from "solady/utils/JSONParserLib.sol";
import {LibString} from "solady/utils/LibString.sol";
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

/// @notice Two-source, fully collateralized AND/OR test prediction pool.
/// No administrator can change policy or withdraw reserves. Airnode authenticates Polymarket's
/// response; it does not establish the truth of the event or remove upstream/cache/oracle risk.
contract SecondOrderMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using JSONParserLib for JSONParserLib.Item;

    enum Phase { Uninitialized, Open, Settled, Void }
    struct Source {
        string marketId;
        bytes32 conditionId;
        bytes32 outcomesHash; // keccak256(abi.encode(decoded outcome 0, decoded outcome 1))
        bytes32 createRequestHash;
        bytes32 settlementRequestHash;
        address signer;
        uint8 selectedOutcome;
        uint64 endTime;
    }
    struct Policy {
        Source[2] sources;
        bool operatorIsOr;
        uint64 tradeClosesAt;
        uint64 deadline;
        uint32 maxEnvelopeAge;
        uint32 maxSourceAge;
    }
    struct Proof { uint256 timestamp; bytes data; bytes signature; }
    struct Mandate {
        address beneficiary;
        bool side;
        uint256 perAction;
        uint256 total;
        uint32 maxActions;
        uint64 expiry;
        uint256 spent;
        uint32 actions;
    }
    struct Stake { uint256 amount; bool claimed; }
    struct State {
        Phase phase;
        bool tradingHalted;
        bool result;
        bool[2] sourceFinal;
        bool[2] sourceSelectedWon;
        uint256 yesStake;
        uint256 noStake;
        uint256 reserve;
        uint256 winnerRemainingStake;
    }

    IERC20 public immutable collateral;
    uint256 public immutable createdAt;
    uint256 public constant FUTURE_TOLERANCE = 30;
    Policy private _policy;
    State private _state;
    uint256[2] public initialSourceUpdatedAt;
    mapping(address => Mandate) public mandates;
    mapping(address => Stake) public stakes;
    mapping(address => mapping(bytes32 => bool)) public consumedIntents;

    error InvalidPolicy();
    error WrongPhase();
    error InvalidComponent();
    error ResponseTooOld(uint256 timestamp);
    error FutureTimestamp(uint256 timestamp);
    error SourceTooOld(uint256 timestamp);
    error SourceBeforeMarket(uint256 timestamp);
    error IdentityMismatch();
    error OutcomesMismatch();
    error NotOpen();
    error NotFinal();
    error UnsupportedPayout();
    error InvalidMandate();
    error MandateAlreadyExists();
    error MandateExpired();
    error BudgetExceeded();
    error DuplicateIntent();
    error TradingClosed();
    error NotClaimable();
    error AlreadyClaimed();

    event Initialized(uint256 source0UpdatedAt, uint256 source1UpdatedAt);
    event Authorized(address indexed payer, address indexed beneficiary, bool side, uint256 total, uint64 expiry);
    event Funded(bytes32 indexed intentId, address indexed payer, address indexed beneficiary, bool side, uint256 amount);
    event SourceFinalized(uint8 indexed component, bool selectedWon, uint256 sourceUpdatedAt);
    event Settled(bool result, uint256 yesStake, uint256 noStake);
    event Voided(bytes32 reason);
    event Claimed(address indexed payer, address indexed beneficiary, uint256 amount, bool refund);

    constructor(address collateral_, Policy memory policy_) {
        if (collateral_ == address(0) || policy_.tradeClosesAt <= block.timestamp
            || policy_.deadline <= policy_.tradeClosesAt || policy_.maxEnvelopeAge == 0
            || policy_.maxEnvelopeAge > 3600 || policy_.maxSourceAge == 0 || policy_.maxSourceAge > 1 days) {
            revert InvalidPolicy();
        }
        for (uint256 i; i < 2; ++i) {
            Source memory s = policy_.sources[i];
            if (bytes(s.marketId).length == 0 || s.conditionId == bytes32(0) || s.outcomesHash == bytes32(0)
                || s.createRequestHash == bytes32(0) || s.settlementRequestHash == bytes32(0)
                || s.createRequestHash == s.settlementRequestHash || s.signer == address(0)
                || s.selectedOutcome > 1 || s.endTime <= policy_.tradeClosesAt || s.endTime >= policy_.deadline) {
                revert InvalidPolicy();
            }
        }
        if (LibString.eq(policy_.sources[0].marketId, policy_.sources[1].marketId)
            || policy_.sources[0].conditionId == policy_.sources[1].conditionId) revert InvalidPolicy();
        collateral = IERC20(collateral_);
        createdAt = block.timestamp;
        _policy = policy_;
    }

    function policy() external view returns (Policy memory) { return _policy; }
    function sources(uint256 component) external view returns (Source memory) { return _policy.sources[component]; }
    function marketState() external view returns (State memory) { return _state; }

    /// @notice Read-only judge tool using exactly the same verifier as initialize/fund, without phase/budget gates.
    /// It does not authorize a stake or change state. Timely proofs still must match the immutable source policy.
    function validateOpenProof(uint8 component, Proof calldata proof) external view returns (uint256 updatedAt) {
        if (component > 1) revert InvalidComponent();
        return _verifyOpen(component, proof);
    }

    /// @notice Anyone may prove both fixed sources are currently open. No funding exists before this check.
    function initialize(Proof[2] calldata proofs) external {
        if (_state.phase != Phase.Uninitialized) revert WrongPhase();
        if (block.timestamp >= _policy.tradeClosesAt) revert TradingClosed();
        for (uint8 i; i < 2; ++i) initialSourceUpdatedAt[i] = _verifyOpen(i, proofs[i]);
        _state.phase = Phase.Open;
        emit Initialized(initialSourceUpdatedAt[0], initialSourceUpdatedAt[1]);
    }

    /// @notice One immutable mandate per payer for this basket. Only the payer may establish it.
    /// Token/recipient are this deployment; gas/API limits are enforced by the off-chain executor.
    function authorize(address beneficiary, bool side, uint256 perAction, uint256 total, uint32 maxActions, uint64 expiry)
        external
    {
        if (_state.phase != Phase.Open || _state.tradingHalted || block.timestamp >= _policy.tradeClosesAt) {
            revert TradingClosed();
        }
        if (mandates[msg.sender].beneficiary != address(0)) revert MandateAlreadyExists();
        if (beneficiary == address(0) || perAction == 0 || total < perAction || maxActions == 0
            || maxActions > 100 || expiry <= block.timestamp || expiry > _policy.tradeClosesAt) revert InvalidMandate();
        mandates[msg.sender] = Mandate(beneficiary, side, perAction, total, maxActions, expiry, 0, 0);
        emit Authorized(msg.sender, beneficiary, side, total, expiry);
    }

    /// @notice A funded test wallet executes its delegated mandate. Fresh open proofs are required for every stake.
    function fund(bytes32 intentId, uint256 amount, Proof[2] calldata proofs) external nonReentrant {
        if (_state.phase != Phase.Open || _state.tradingHalted || block.timestamp >= _policy.tradeClosesAt) {
            revert TradingClosed();
        }
        Mandate storage mandate = mandates[msg.sender];
        if (mandate.beneficiary == address(0)) revert InvalidMandate();
        if (block.timestamp >= mandate.expiry) revert MandateExpired();
        if (intentId == bytes32(0) || consumedIntents[msg.sender][intentId]) revert DuplicateIntent();
        if (amount == 0 || amount > mandate.perAction || amount > mandate.total - mandate.spent
            || mandate.actions >= mandate.maxActions) revert BudgetExceeded();
        for (uint8 i; i < 2; ++i) {
            if (_verifyOpen(i, proofs[i]) < initialSourceUpdatedAt[i]) revert SourceBeforeMarket(initialSourceUpdatedAt[i]);
        }
        consumedIntents[msg.sender][intentId] = true;
        mandate.spent += amount;
        mandate.actions += 1;
        stakes[msg.sender].amount += amount;
        if (mandate.side) _state.yesStake += amount; else _state.noStake += amount;
        _state.reserve += amount;
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(intentId, msg.sender, mandate.beneficiary, mandate.side, amount);
    }

    /// @notice Permissionless proof submission. First valid final source immediately stops trading.
    /// Only authenticated resolved/closed one-hot records can finalize a component. Ambiguity waits for deadline.
    function submitEvidence(uint8 component, Proof calldata proof) external {
        if (_state.phase != Phase.Open) revert WrongPhase();
        if (component > 1) revert InvalidComponent();
        if (block.timestamp >= _policy.deadline) revert TradingClosed();
        if (_state.sourceFinal[component]) revert DuplicateIntent();
        uint256 updatedAt = _verifyCommon(component, proof, true);
        if (proof.timestamp < createdAt || updatedAt < createdAt) revert SourceBeforeMarket(updatedAt);
        if (!ProjectedJson.readBool(proof.data, "closed")
            || !LibString.eq(ProjectedJson.readString(proof.data, "status"), "resolved")) revert NotFinal();
        bytes memory prices = bytes(ProjectedJson.readString(proof.data, "outcomePrices"));
        JSONParserLib.Item memory array = JSONParserLib.parse(string(prices));
        if (!array.isArray() || array.size() != 2) revert OutcomesMismatch();
        // Compare the exact numeric strings: decimal rounding must never manufacture a terminal result.
        string memory p0 = ProjectedJson.readString(prices, uint256(0));
        string memory p1 = ProjectedJson.readString(prices, uint256(1));
        bool firstWins = LibString.eq(p0, "1") && LibString.eq(p1, "0");
        bool secondWins = LibString.eq(p0, "0") && LibString.eq(p1, "1");
        if (!firstWins && !secondWins) revert UnsupportedPayout();
        bool selectedWon = _policy.sources[component].selectedOutcome == 0 ? firstWins : secondWins;
        _state.tradingHalted = true;
        _state.sourceFinal[component] = true;
        _state.sourceSelectedWon[component] = selectedWon;
        emit SourceFinalized(component, selectedWon, updatedAt);
        if (_state.sourceFinal[0] && _state.sourceFinal[1]) {
            if (_state.yesStake == 0 || _state.noStake == 0) { _void(keccak256("UNMATCHED_POOL")); return; }
            _state.result = _policy.operatorIsOr
                ? _state.sourceSelectedWon[0] || _state.sourceSelectedWon[1]
                : _state.sourceSelectedWon[0] && _state.sourceSelectedWon[1];
            _state.phase = Phase.Settled;
            _state.winnerRemainingStake = _state.result ? _state.yesStake : _state.noStake;
            emit Settled(_state.result, _state.yesStake, _state.noStake);
        }
    }

    /// @notice Timeout is fixed in policy; an unmatched pool can be voided as soon as trading closes.
    function voidExpired() external {
        if (_state.phase != Phase.Open) revert WrongPhase();
        if (block.timestamp < _policy.deadline
            && !(block.timestamp >= _policy.tradeClosesAt && (_state.yesStake == 0 || _state.noStake == 0))) {
            revert NotClaimable();
        }
        _void(keccak256("DEADLINE_OR_UNMATCHED"));
    }

    /// @notice Anyone may trigger delivery, but funds always go to the payer's original beneficiary.
    /// The last winning stake receives integer-rounding dust; unsolicited tokens are never counted as reserve.
    function claim(address payer) external nonReentrant returns (uint256 amount) {
        if (_state.phase != Phase.Settled && _state.phase != Phase.Void) revert NotClaimable();
        Stake storage stake = stakes[payer];
        if (stake.claimed) revert AlreadyClaimed();
        if (stake.amount == 0) revert NotClaimable();
        stake.claimed = true;
        Mandate storage mandate = mandates[payer];
        bool refund = _state.phase == Phase.Void;
        if (refund) amount = stake.amount;
        else if (mandate.side == _state.result) {
            uint256 winningTotal = _state.result ? _state.yesStake : _state.noStake;
            amount = stake.amount == _state.winnerRemainingStake
                ? _state.reserve
                : ((_state.yesStake + _state.noStake) * stake.amount) / winningTotal;
            _state.winnerRemainingStake -= stake.amount;
        }
        _state.reserve -= amount;
        if (amount != 0) collateral.safeTransfer(mandate.beneficiary, amount);
        emit Claimed(payer, mandate.beneficiary, amount, refund);
    }

    function _verifyOpen(uint8 component, Proof calldata proof) internal view returns (uint256 updatedAt) {
        updatedAt = _verifyCommon(component, proof, false);
        if (ProjectedJson.readBool(proof.data, "closed")) revert NotOpen();
        if (ProjectedJson.readTimestamp(proof.data, "endDate") != _policy.sources[component].endTime) {
            revert IdentityMismatch();
        }
        if (_policy.sources[component].endTime <= block.timestamp) revert NotOpen();
    }

    function _verifyCommon(uint8 component, Proof calldata proof, bool settlement)
        internal view returns (uint256 updatedAt)
    {
        Source storage source = _policy.sources[component];
        AirnodeV2Attestation.verify(source.signer,
            settlement ? source.settlementRequestHash : source.createRequestHash,
            proof.timestamp, proof.data, proof.signature);
        if (proof.timestamp > block.timestamp + FUTURE_TOLERANCE) revert FutureTimestamp(proof.timestamp);
        if (proof.timestamp + _policy.maxEnvelopeAge < block.timestamp) revert ResponseTooOld(proof.timestamp);
        if (!LibString.eq(ProjectedJson.readString(proof.data, "marketId"), source.marketId)
            || ProjectedJson.readBytes32(proof.data, "conditionId") != source.conditionId) revert IdentityMismatch();
        bytes memory outcomes = bytes(ProjectedJson.readString(proof.data, "outcomes"));
        JSONParserLib.Item memory array = JSONParserLib.parse(string(outcomes));
        if (!array.isArray() || array.size() != 2
            || keccak256(abi.encode(ProjectedJson.readString(outcomes, uint256(0)),
                ProjectedJson.readString(outcomes, uint256(1)))) != source.outcomesHash) revert OutcomesMismatch();
        updatedAt = ProjectedJson.readTimestamp(proof.data, "updatedAt");
        if (updatedAt > block.timestamp + FUTURE_TOLERANCE) revert FutureTimestamp(updatedAt);
        if (updatedAt + _policy.maxSourceAge < block.timestamp) revert SourceTooOld(updatedAt);
    }

    function _void(bytes32 reason) private {
        _state.phase = Phase.Void;
        _state.tradingHalted = true;
        emit Voided(reason);
    }
}
