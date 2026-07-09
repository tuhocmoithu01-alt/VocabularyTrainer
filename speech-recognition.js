export function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionConstructor());
}

export function getSpeechRecognitionUnsupportedMessage() {
  return 'Trình duyệt hiện tại không hỗ trợ nhận diện giọng nói. Khuyến nghị sử dụng Google Chrome.';
}

export function getSpeechRecognitionErrorMessage(errorCode) {
  switch (errorCode) {
    case 'network':
      return 'Lỗi mạng khi nhận diện giọng nói. Vui lòng kiểm tra kết nối mạng.';
    case 'no-speech':
      return 'Không phát hiện giọng nói. Vui lòng nói rõ hơn.';
    case 'audio-capture':
      return 'Không thể truy cập Microphone. Vui lòng kiểm tra thiết bị và quyền truy cập.';
    case 'not-allowed':
      return 'Bạn cần cấp quyền Microphone để sử dụng Speaking Test.';
    case 'aborted':
      return 'Quá trình nhận diện bị hủy.';
    default:
      return 'Đã xảy ra lỗi khi nhận diện giọng nói. Vui lòng thử lại.';
  }
}

export async function requestMicrophoneAccess() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      success: false,
      reason: 'unavailable',
      error: null,
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { success: true, reason: null, error: null };
  } catch (error) {
    console.error('Microphone access request failed', error);
    return {
      success: false,
      reason: error?.name || 'permission-denied',
      error,
    };
  }
}
