// What members are sent, in the gym's language for them (D-23): its
// settings.emailLanguage, English unless the gym chose French. Staff emails
// stay in English for now; staff read GEM itself in the language they choose.
const { MAKER } = require('./emailLayout');

const TEXT = {
  en: {
    callUsPhone: (phone) => `If anything doesn't look right, call us on ${phone} and we'll sort it out.`,
    callUsDesk: "If anything doesn't look right, speak to us at the front desk and we'll sort it out.",
    memberId: 'Member ID',
    checkInCode: 'Check-in code',
    welcome: {
      subject: (gym) => `Welcome to ${gym}`,
      eyebrow: 'Welcome',
      line: (gym) => `Your membership at ${gym} is set up. Here is what you need to check in.`,
      preheader: (code) => `Your membership is set up. Member ID ${code}`.trim(),
      package: 'Package', starts: 'Starts', validUntil: 'Valid until',
      keepCode: 'Keep your check-in code to yourself: it is how the front desk knows it is you.',
      seeYou: 'See you at the gym.',
    },
    receipt: {
      subject: (amount, gym) => `Payment receipt: ${amount}, ${gym}`,
      eyebrow: 'Payment received', title: 'Thank you for your payment',
      preheader: (amount) => `We received ${amount}. Your receipt is attached.`,
      thanks: 'Thank you, we have received your payment.',
      amountPaid: 'Amount paid', reference: 'Reference', for: 'For', paidBy: 'Paid by', balanceLeft: 'Balance left to pay',
      attached: 'Your receipt is attached to this email as a PDF you can download and keep.',
    },
    code: {
      subject: (gym) => `Your check-in code, ${gym}`,
      eyebrow: 'Check-in code', title: 'Your check-in code', preheader: 'Your check-in code is inside.',
      line: (gym) => `Here is your check-in code for ${gym}. Give it at the front desk when you come in.`,
      keep: 'Keep it to yourself: it is how we know it is you.',
    },
    changes: {
      extend_membership: { subject: 'Your membership was extended', eyebrow: 'Membership extended', line: 'Your membership has been extended.' },
      freeze_membership: { subject: 'Your membership was frozen', eyebrow: 'Membership frozen', line: 'Your membership has been frozen (paused). It will carry on once it is unfrozen.' },
      unfreeze_membership: { subject: 'Your membership was unfrozen', eyebrow: 'Membership resumed', line: 'Your membership has been unfrozen and is active again.' },
      cancel_membership: { subject: 'Your membership was cancelled', eyebrow: 'Membership cancelled', line: 'Your membership has been cancelled.' },
      convert_to_visitor: { subject: 'You are now on a visitor pass', eyebrow: 'Visitor pass', line: 'Your membership has been changed to a visitor pass.' },
      renew_membership: { subject: 'Your membership was renewed', eyebrow: 'Membership renewed', line: 'Your membership has been renewed.' },
    },
    status: 'Status',
    coach: {
      subject: (gym) => `Meet your coach, ${gym}`,
      eyebrow: 'Your coach', title: 'Meet your coach',
      preheader: (name) => `${name} is now your coach.`,
      line: (name, gym) => `${name} is now your coach at ${gym}. They will set your goals with you, take your measurements each week and help you stay on track.`,
      section: 'Your coach', coach: 'Coach', email: 'Email', phone: 'Phone',
      next: 'Get in touch with them to plan your first session.',
    },
    methods: { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', mobile_money: 'Mobile money' },
    statuses: {
      active: 'Active', visitor: 'Active', registered: 'Registered', pending: 'Starts soon', expiring: 'Ending soon', frozen: 'Frozen',
      suspended: 'Suspended', expired: 'Expired', cancelled: 'Cancelled', deactivated: 'Deactivated',
    },
    pdf: {
      receipt: 'RECEIPT', amountPaid: 'AMOUNT PAID', reference: 'Receipt reference', paidBy: 'Paid by', memberId: 'Member ID',
      method: 'Payment method', description: 'Description', balanceAfter: 'Balance after payment',
      thanks: 'Thank you for your payment. Please keep this receipt for your records.', poweredBy: `GEM · Powered by ${MAKER}`,
    },
  },
  fr: {
    callUsPhone: (phone) => `Si quelque chose ne va pas, appelez-nous au ${phone} et nous arrangerons cela.`,
    callUsDesk: "Si quelque chose ne va pas, parlez-en à l'accueil et nous arrangerons cela.",
    memberId: 'Numéro de membre',
    checkInCode: "Code d'entrée",
    welcome: {
      subject: (gym) => `Bienvenue chez ${gym}`,
      eyebrow: 'Bienvenue',
      line: (gym) => `Votre abonnement chez ${gym} est en place. Voici ce qu'il vous faut pour entrer.`,
      preheader: (code) => `Votre abonnement est en place. Numéro de membre ${code}`.trim(),
      package: 'Forfait', starts: 'Début', validUntil: "Valable jusqu'au",
      keepCode: "Gardez votre code d'entrée pour vous : c'est ainsi que l'accueil sait que c'est bien vous.",
      seeYou: 'À bientôt à la salle.',
    },
    receipt: {
      subject: (amount, gym) => `Reçu de paiement : ${amount}, ${gym}`,
      eyebrow: 'Paiement reçu', title: 'Merci pour votre paiement',
      preheader: (amount) => `Nous avons reçu ${amount}. Votre reçu est joint.`,
      thanks: 'Merci, nous avons bien reçu votre paiement.',
      amountPaid: 'Montant payé', reference: 'Référence', for: 'Objet', paidBy: 'Moyen de paiement', balanceLeft: 'Reste à payer',
      attached: 'Votre reçu est joint à cet e-mail en PDF, à télécharger et à garder.',
    },
    code: {
      subject: (gym) => `Votre code d'entrée, ${gym}`,
      eyebrow: "Code d'entrée", title: "Votre code d'entrée", preheader: "Votre code d'entrée est à l'intérieur.",
      line: (gym) => `Voici votre code d'entrée pour ${gym}. Donnez-le à l'accueil en arrivant.`,
      keep: "Gardez-le pour vous : c'est ainsi que nous savons que c'est bien vous.",
    },
    changes: {
      extend_membership: { subject: 'Votre abonnement a été prolongé', eyebrow: 'Abonnement prolongé', line: 'Votre abonnement a été prolongé.' },
      freeze_membership: { subject: 'Votre abonnement a été mis en pause', eyebrow: 'Abonnement en pause', line: 'Votre abonnement a été mis en pause. Il reprendra une fois réactivé.' },
      unfreeze_membership: { subject: 'Votre abonnement a repris', eyebrow: 'Abonnement repris', line: 'Votre abonnement a repris et il est de nouveau actif.' },
      cancel_membership: { subject: 'Votre abonnement a été annulé', eyebrow: 'Abonnement annulé', line: 'Votre abonnement a été annulé.' },
      convert_to_visitor: { subject: 'Vous avez maintenant un pass visiteur', eyebrow: 'Pass visiteur', line: 'Votre abonnement a été changé en pass visiteur.' },
      renew_membership: { subject: 'Votre abonnement a été renouvelé', eyebrow: 'Abonnement renouvelé', line: 'Votre abonnement a été renouvelé.' },
    },
    status: 'Statut',
    coach: {
      subject: (gym) => `Votre coach, ${gym}`,
      eyebrow: 'Votre coach', title: 'Faites connaissance avec votre coach',
      preheader: (name) => `${name} est désormais votre coach.`,
      line: (name, gym) => `${name} est désormais votre coach chez ${gym}. Ensemble, vous fixerez vos objectifs ; vos mesures seront prises chaque semaine pour vous aider à garder le cap.`,
      section: 'Votre coach', coach: 'Coach', email: 'E-mail', phone: 'Téléphone',
      next: 'Contactez votre coach pour planifier votre première séance.',
    },
    methods: { cash: 'Espèces', card: 'Carte', bank_transfer: 'Virement bancaire', mobile_money: 'Mobile money' },
    statuses: {
      active: 'Actif', visitor: 'Actif', registered: 'Inscrit', pending: 'Commence bientôt', expiring: 'Se termine bientôt', frozen: 'En pause',
      suspended: 'Suspendu', expired: 'Expiré', cancelled: 'Annulé', deactivated: 'Désactivé',
    },
    pdf: {
      receipt: 'REÇU', amountPaid: 'MONTANT PAYÉ', reference: 'Référence du reçu', paidBy: 'Payé par', memberId: 'Numéro de membre',
      method: 'Moyen de paiement', description: 'Objet', balanceAfter: 'Reste après paiement',
      thanks: 'Merci pour votre paiement. Veuillez conserver ce reçu.', poweredBy: `GEM · Propulsé par ${MAKER}`,
    },
  },
};

const EMAIL_LANGUAGES = ['en', 'fr'];
const languageOf = (gym) => (gym?.settings?.emailLanguage === 'fr' ? 'fr' : 'en');
const textFor = (gym) => TEXT[languageOf(gym)];

module.exports = { TEXT, EMAIL_LANGUAGES, languageOf, textFor };
