export function createMockPaymentGateway() {
  return {
    async charge({ shouldDecline = false } = {}) {
      if (shouldDecline) {
        return { ok: false, code: 'PAYMENT_DECLINED', message: 'Payment was declined' };
      }
      return { ok: true, code: 'OK', message: 'Payment approved' };
    },
  };
}

export default createMockPaymentGateway;
