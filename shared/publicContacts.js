// Public IPS contact destinations only. Never store provider API tokens here.
// These are click-to-chat links, NOT evidence of a connected API webhook or working owner inbox.
export const PUBLIC_CONTACTS = Object.freeze({
  whatsapp: Object.freeze({
    number: '48794088714',
    display: '+48 794 088 714',
    url: 'https://wa.me/48794088714',
    available: true,
    connected: false,
    mode: 'direct',
    manual_confirmation: true
  }),
  telegram: Object.freeze({
    username: 'IPScontactBot',
    display: '@IPScontactBot',
    url: 'https://t.me/IPScontactBot',
    // Public user-initiated link is safe after the owner confirmed token rotation.
    // Bot webhook and automated replies are not yet configured.
    available: true,
    connected: false
  })
});
