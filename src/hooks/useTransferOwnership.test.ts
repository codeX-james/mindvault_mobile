import { Keypair } from "@stellar/stellar-sdk";
import { act, renderHook } from "@testing-library/react-native";

import { prepareOwnershipTransfer, submitOwnershipTransfer } from "../api/resources";
import { useTransferOwnership, validateStellarAddress } from "./useTransferOwnership";

jest.mock("../api/resources", () => ({
  prepareOwnershipTransfer: jest.fn(),
  submitOwnershipTransfer: jest.fn(),
}));

const mockedPrepare = prepareOwnershipTransfer as jest.Mock;
const mockedSubmit = submitOwnershipTransfer as jest.Mock;

describe("validateStellarAddress", () => {
  it("accepts a valid ed25519 public key", () => {
    const publicKey = Keypair.random().publicKey();
    expect(validateStellarAddress(publicKey)).toBe(true);
    expect(validateStellarAddress(`  ${publicKey.toLowerCase()}  `)).toBe(true);
  });

  it("rejects empty and whitespace-only input", () => {
    expect(validateStellarAddress("")).toBe(false);
    expect(validateStellarAddress("   ")).toBe(false);
  });

  it("rejects malformed keys", () => {
    expect(validateStellarAddress("not-a-key")).toBe(false);
    expect(validateStellarAddress("GABC")).toBe(false);
    expect(validateStellarAddress("S" + "A".repeat(55))).toBe(false);
  });

  it("rejects keys with valid length but invalid checksum", () => {
    const publicKey = Keypair.random().publicKey();
    const tampered = publicKey.slice(0, -1) + (publicKey.endsWith("A") ? "B" : "A");
    expect(validateStellarAddress(tampered)).toBe(false);
  });
});

describe("useTransferOwnership signing", () => {
  const destination = Keypair.random().publicKey();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrepare.mockResolvedValue({
      unsignedXdr: "unsigned-xdr",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  async function prepared() {
    const hook = renderHook(() => useTransferOwnership());
    act(() => hook.result.current.setDestinationAddress(destination));
    await act(() => hook.result.current.start("r1"));
    expect(hook.result.current.pendingTransaction).not.toBeNull();
    return hook;
  }

  it("closes the signing sheet and reports the error when submission fails", async () => {
    mockedSubmit.mockRejectedValue(new Error("tx_bad_seq"));
    const { result } = await prepared();

    await act(() => result.current.submitSigned("signed-xdr"));

    expect(result.current.pendingTransaction).toBeNull();
    expect(result.current.step).toBe("error");
    expect(result.current.error).toBe("tx_bad_seq");
  });

  it("never submits the unsigned XDR", async () => {
    const { result } = await prepared();

    await act(() => result.current.submitSigned("unsigned-xdr"));

    expect(mockedSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingTransaction).toBeNull();
    expect(result.current.step).toBe("error");
  });
});
