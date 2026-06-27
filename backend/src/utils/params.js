function parsePositiveIntParam(value) {
  const raw = String(value);

  // Path ID musi byt cele kladne cislo v celem retezci.
  // parseInt("1 OR 1=1", 10) by vratil 1, proto ho tady nepouzivame.
  if (!/^[1-9][0-9]*$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

module.exports = {
  parsePositiveIntParam,
};
