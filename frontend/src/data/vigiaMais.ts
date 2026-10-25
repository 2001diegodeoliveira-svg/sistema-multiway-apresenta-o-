// Adesão dos municípios de MT ao programa Vigia Mais MT (SESP-MT).
// Fonte: Rádio Liberdade FM, "Programa Vigia Mais MT alcança adesão em 90% dos municípios de Mato Grosso".
// Dos 142 municípios: 128 aderiram, 3 estão em processo de adesão e 11 não aderiram.
// A SESP não publica a posição exata nem a quantidade de câmeras por município.
// Os 128 aderidos são calculados por exclusão: IBGE (142) - não aderiram (11) - em adesão (3).

export const NAO_ADERIRAM = [
  "Boa Esperança do Norte",
  "Cotriguaçu",
  "Denise",
  "Nossa Senhora do Livramento",
  "Paranaíta",
  "Planalto da Serra",
  "Pontes e Lacerda",
  "Poxoréu",
  "Primavera do Leste",
  "Santo Antônio de Leverger",
  "Tangará da Serra",
];

export const EM_ADESAO = ["Apiacás", "Porto Estrela", "Jaciara"];

export function isVigiaAderido(nome: string): boolean {
  return !NAO_ADERIRAM.includes(nome) && !EM_ADESAO.includes(nome);
}
