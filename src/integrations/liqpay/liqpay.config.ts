export type LiqPaySignatureAlgorithm = 'sha3-256' | 'sha1';

export interface LiqPayConfig {
  publicKey: string;
  privateKey: string;
  sandbox: boolean;
  signatureAlgorithm: LiqPaySignatureAlgorithm;
  /** Public URL LiqPay posts payment status callbacks to. */
  serverUrl: string;
  /** Storefront page the customer returns to; `?orderId=` is appended. */
  resultUrl: string;
  /**
   * Id of the good in LiqPay "РРО → Товари" used on fiscal receipts.
   * Receipts are not requested when unset.
   */
  receiptGoodId: number | null;
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

  const receiptGoodId = process.env.LIQPAY_RRO_GOOD_ID
    ? Number(process.env.LIQPAY_RRO_GOOD_ID)
    : null;

  if (receiptGoodId !== null && !Number.isInteger(receiptGoodId)) {
    throw new Error('LIQPAY_RRO_GOOD_ID must be a numeric LiqPay good id');
  }

  return {
    publicKey,
    privateKey,
    sandbox: process.env.LIQPAY_SANDBOX === 'true',
    signatureAlgorithm: algorithm,
    serverUrl: `${publicApiUrl.replace(/\/$/, '')}/api/payments/liqpay/callback`,
    resultUrl,
    receiptGoodId,
  };
}
