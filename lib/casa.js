/**
 * Dados de contato da casa, num lugar só.
 *
 * Estavam espalhados como href="#" pelo componente — botões que o cliente
 * clicava e nada acontecia. O que eu não tenho de fato fica como null e o
 * botão simplesmente não é renderizado, em vez de existir quebrado.
 *
 * PENDENTE com o cliente: telefone do WhatsApp e endereço exato do salão.
 * Assim que chegarem, preencha aqui — nenhuma outra alteração é necessária.
 */
export const CASA = {
  nome: 'Pão da Primavera Boulangerie',
  site: 'https://www.paodaprimavera.com.br',
  instagram: 'https://instagram.com/paodaprimaveracampinas',
  facebook: 'https://facebook.com/paodaprimavera',

  // Busca pelo nome no Maps: leva ao lugar certo sem eu chutar um endereço.
  mapa: 'https://www.google.com/maps/search/?api=1&query=P%C3%A3o+da+Primavera+Boulangerie+Camb%C3%BAi+Campinas',

  whatsapp: null,   // ex.: 'https://wa.me/5519XXXXXXXXX'
  endereco: null,   // ex.: 'R. Exemplo, 000 — Cambuí, Campinas/SP'

  horario: { rotulo: 'Aberto agora', ate: 'até 21h45' }
};
