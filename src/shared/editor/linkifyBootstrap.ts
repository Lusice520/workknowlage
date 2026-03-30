import { registerCustomProtocol } from 'linkifyjs';

const LINKIFY_PROTOCOL_BOOTSTRAP_KEY = '__workknowlage_linkify_protocols_bootstrapped__';
const VALID_LINK_PROTOCOLS = Object.freeze([
  'http',
  'https',
  'ftp',
  'ftps',
  'mailto',
  'tel',
  'callto',
  'sms',
  'cid',
  'xmpp',
]);

export const ensureLinkifyProtocolsRegistered = () => {
  if (typeof globalThis === 'undefined') return;
  if ((globalThis as Record<string, unknown>)[LINKIFY_PROTOCOL_BOOTSTRAP_KEY]) return;

  VALID_LINK_PROTOCOLS.forEach((protocol) => {
    registerCustomProtocol(protocol);
  });

  (globalThis as Record<string, unknown>)[LINKIFY_PROTOCOL_BOOTSTRAP_KEY] = true;
};
