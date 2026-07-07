export async function playAudioFeedback(audio, enabled, onError = console.error) {
  if (!enabled || !audio) {
    return false;
  }

  audio.currentTime = 0;
  try {
    await audio.play();
    return true;
  } catch (error) {
    if (onError) {
      onError(error);
    }
    return false;
  }
}
