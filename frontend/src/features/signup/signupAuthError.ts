export function getSignupAuthErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.toLocaleLowerCase();
  if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
    return '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해 주세요.';
  }
  if (message.includes('invalid') && (message.includes('otp') || message.includes('token'))) {
    return '인증번호가 올바르지 않습니다. 다시 확인해 주세요.';
  }
  if (message.includes('expired'))
    return '인증번호가 만료되었습니다. 인증 메일을 다시 받아 주세요.';
  if (message.includes('rate') || message.includes('too many')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (message.includes('password')) return '비밀번호 정책을 확인한 뒤 다시 시도해 주세요.';
  if (message.includes('email')) return '이메일 주소를 확인한 뒤 다시 시도해 주세요.';
  if (message.includes('network') || message.includes('fetch')) {
    return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  return fallback;
}
