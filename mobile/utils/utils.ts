export function wait(time: number) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

export function validJSON(string: string) {
  try {
    JSON.parse(string);
  } catch (e) {
    return false;
  }
  return true;
}
