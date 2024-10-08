export async function sleep(time: number) {
  if (time === 0) {
    return;
  }
  return new Promise((resolve) => setTimeout(resolve, time));
}
