export type LiqPaySignatureAlgorithm = 'sha3-256' | 'sha1';

/** LiqPay shops: one per store, each with its own payout account. */
export const LIQPAY_MERCHANTS = ['gripr', 'lab'] as const;
export type LiqPayMerchant = (typeof LIQPAY_MERCHANTS)[number];

export interface LiqPayMerchantConfig {
  publicKey: string;
  privateKey: string;
  /**
   * Id of the good in LiqPay "РРО → Товари" used on fiscal receipts.
   * Receipts are not requested when unset.
   */
  receiptGoodId: number | null;
}

export interface LiqPayConfig {
  /** `null` when the shop is not configured; its payments are refused. */
  merchants: Record<LiqPayMerchant, LiqPayMerchantConfig | null>;
  sandbox: boolean;
  signatureAlgorithm: LiqPaySignatureAlgorithm;
  /** Public URL LiqPay posts payment status callbacks to. */
  serverUrl: string;
  /** Storefront page the customer returns to; `?orderId=` is appended. */
  resultUrl: string;
}

export const LIQPAY_CONFIG = Symbol('LIQPAY_CONFIG');

export function getLiqPayConfig(): LiqPayConfig {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY;
  const privateKey = process.env.LIQPAY_PRIVATE_KEY;
  const publicApiUrl = process.env.PUBLIC_API_URL;
  const resultUrl = process.env.LIQPAY_RESULT_URL;

  if (!publicKey || !privateKey || !publicApiUrl || !resultUrl) {
    throw new Error(
      'LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY, PUBLIC_API_URL, and LIQPAY_RESULT_URL must be configured',
    );
  }

  const algorithm = process.env.LIQPAY_SIGNATURE_ALGORITHM || 'sha3-256';

  if (algorithm !== 'sha3-256' && algorithm !== 'sha1') {
    throw new Error('LIQPAY_SIGNATURE_ALGORITHM must be sha3-256 or sha1');
  }

  const labPublicKey = process.env.LIQPAY_LAB_PUBLIC_KEY;
  const labPrivateKey = process.env.LIQPAY_LAB_PRIVATE_KEY;

  if (Boolean(labPublicKey) !== Boolean(labPrivateKey)) {
    throw new Error(
      'Set both LIQPAY_LAB_PUBLIC_KEY and LIQPAY_LAB_PRIVATE_KEY, or neither',
    );
  }

  return {
    merchants: {
      gripr: {
        publicKey,
        privateKey,
        receiptGoodId: goodId('LIQPAY_RRO_GOOD_ID'),
      },
      lab:
        labPublicKey && labPrivateKey
          ? {
              publicKey: labPublicKey,
              privateKey: labPrivateKey,
              receiptGoodId: goodId('LIQPAY_LAB_RRO_GOOD_ID'),
            }
          : null,
    },
    sandbox: process.env.LIQPAY_SANDBOX === 'true',
    signatureAlgorithm: algorithm,
    serverUrl: `${publicApiUrl.replace(/\/$/, '')}/api/payments/liqpay/callback`,
    resultUrl,
  };
}

function goodId(name: string): number | null {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id)) {
    throw new Error(`${name} must be a numeric LiqPay good id`);
  }

  return id;
}
