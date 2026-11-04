/** CPF com dígitos verificadores válidos. */
export function isValidCpf(value?: string | null): boolean {
  const cpf = (value || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** Telefone brasileiro no formato aceito pela invoice do Monetipag: +55 (11) 99999-9999 */
export function formatBrazilPhone(raw?: string | null): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return '';

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
