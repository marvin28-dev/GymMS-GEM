// What staff and owners are sent, in their own language (Staff.language, else
// English). GEM's emails to its admin stay in English.
const { staffLanguage } = require('./language');

const TEXT = {
  en: {
    signInButton: 'Sign in to GEM',
    orGoTo: (url) => `Or go to ${url} and sign in with your usual email and password.`,
    welcome: {
      subject: (gym) => `Your ${gym} account on GEM`,
      preheader: (gym, code) => `Your account at ${gym} is ready. Gym code ${code}.`,
      eyebrow: 'Your new account', title: (gym) => `Welcome to ${gym}`,
      line: (gym) => `An account has been made for you on GEM, the system ${gym} runs on. Here is how to get in.`,
      gymCode: 'Gym code', yourEmail: 'Your email', firstTime: 'Signing in the first time',
      steps: [
        'Open the button above. It already knows your gym.',
        'Type your email and press <strong style="color:#16161d;">Continue</strong>.',
        'As it is your first time, you are asked to <strong style="color:#16161d;">choose a password</strong> (at least 8 characters).',
        'Enter the <strong style="color:#16161d;">4-digit code</strong> your manager reads out to you. It proves the account is yours.',
        'From then on, the same screen asks for your password.',
      ],
      alreadySet: 'If it asks for a password instead of offering to create one, your account is already set up: use <strong style="color:#16161d;">Forgot password</strong> on that screen.',
      noCode: 'Your 4-digit code is never sent by email; ask your manager for it. If you were not expecting this email, you can ignore it.',
    },
    task: {
      priorities: { high: 'High', medium: 'Medium', low: 'Low' },
      aManager: 'A manager',
      given: (who, due) => `${who} has given you a task${due ? `, due on ${due}` : ''}.`,
      priority: 'Priority', due: 'Due', from: 'From', view: 'Sign in and view it',
      subject: (gym, title) => `New task at ${gym}: ${title}`,
      preheader: (title, due) => `${title}${due ? `, due ${due}` : ''}`,
      eyebrow: 'New task', title: 'You have a new task',
      group: {
        line: (due) => `The system raised this task for management${due ? `, due on ${due}` : ''}. Anyone in management can deal with it.`,
        assignedTo: 'Assigned to', management: 'Management', raisedBy: 'Raised by', theSystem: 'The system', review: 'Sign in and review it',
        subject: (gym, title) => `Management task at ${gym}: ${title}`,
        eyebrow: 'Task for management', title: 'A task for management',
      },
    },
    reset: {
      eyebrow: 'Password',
      byManager: {
        subject: (gym) => `Reset your password for ${gym} on GEM`,
        preheader: 'A link to choose a new password, valid for 24 hours.', title: 'Choose a new password',
        line: (sentBy, gym) => `${sentBy ? `${sentBy} sent you` : 'Here is'} a link to choose a new password for your account at ${gym}.`,
        button: 'Choose a new password',
        expires: '<strong style="color:#b4232a;">This link expires in 24 hours.</strong> If you did not expect it, ignore this email and your password stays as it is.',
      },
      forgot: {
        subject: 'Reset your GEM password',
        preheader: 'A link to choose a new password, valid for 15 minutes.', title: 'Reset your password',
        line: (gym) => `We received a request to reset the password for your ${gym} account on GEM. Press the button to choose a new one.`,
        button: 'Reset password',
        expires: '<strong style="color:#b4232a;">This link expires in 15 minutes.</strong> If you asked for another link after this one, only the newest works.',
        ignore: "If you didn't ask for this, you can ignore this email: your password stays as it is.",
      },
    },
    confirm: {
      subject: 'Confirm your email address',
      preheader: 'One click to confirm your email address on GEM.', eyebrow: 'Your account', title: 'Confirm your email',
      line: 'Confirm that this is your email address, so password links and notices from GEM reach you.',
      button: 'Confirm my email',
      valid: (days) => `The link works for ${days} days. You can ask for a new one from GEM at any time.`,
    },
    newGym: {
      subject: (name) => `Welcome to GEM, ${name}! Your gym is ready.`,
      preheader: (gym, code) => `${gym} is live on GEM. Your gym code is ${code}.`,
      eyebrow: 'Your gym is ready', title: (name) => `Welcome, ${name}`,
      line: (gym) => `Your gym ${gym} is live on GEM. Keep these details somewhere safe.`,
      gymCode: 'Gym code', yourRole: 'Your role', owner: 'General Manager', signInEmail: 'Sign-in email',
      open: 'Open your gym',
      steps: ['Add your packages and prices in Settings.', 'Choose the payment methods you accept.', 'Add your staff. Each one gets an email with how to sign in.'],
      notYou: "If you didn't create this account, you can ignore this email.",
    },
    payroll: {
      subject: (gym, period) => `Payroll overdue at ${gym} for ${period}`,
      preheader: (count, period) => `${count} ${count === 1 ? 'staff member is' : 'staff members are'} waiting for ${period} pay.`,
      eyebrow: 'Payroll', title: 'Payroll is overdue',
      line: (gym, period) => `At ${gym}, some staff are past their pay date and still waiting to be paid for ${period}.`,
      waiting: 'Waiting to be paid', staff: (count) => (count === 1 ? 'staff member' : 'staff members'),
      button: 'Open GEM and pay them',
      privacy: 'For privacy, this email has no names, pay dates or amounts. They are only shown inside GEM.',
    },
    gem: {
      bill: {
        sent: { subject: (month, amount) => `Your GEM bill for ${month}: ${amount}`, eyebrow: 'Your GEM bill', title: (month, amount) => `${month}: ${amount}`, line: (gym, month) => `Here is what ${gym} owes GEM for ${month}.` },
        reminder: { subject: (month) => `Reminder: your GEM bill for ${month} is due`, eyebrow: 'Payment reminder', title: (month, amount) => `${amount} is due`, line: (gym, month) => `Your GEM bill for ${month} has not been paid yet. Please pay it so your account stays open.` },
        paid: { subject: (month, amount) => `Thank you: GEM received ${amount}`, eyebrow: 'Payment received', title: () => 'Thank you', line: (gym, month, amount) => `We received ${amount} for ${gym}'s GEM bill for ${month}.` },
        paidLabel: 'Paid', due: 'Amount due',
        month: 'Month', members: 'Active members', rate: 'Price per member',
        days: 'Days charged', daysOf: (n, of) => `${n} of ${of} (after your free trial)`,
        discount: 'Discount', dueBy: 'Due by',
        howToPay: 'How to pay', replyToPay: 'Reply to this email to arrange payment.',
        see: 'See it in GEM',
      },
      lock: {
        subject: (gym, locked) => (locked ? `Your GEM account for ${gym} is paused` : `Your GEM account for ${gym} is open again`),
        preheader: (locked) => (locked ? 'Your staff cannot use GEM until the account is reopened.' : 'Everyone can use GEM again.'),
        eyebrow: (locked) => (locked ? 'Account paused' : 'Account open'),
        title: (locked) => (locked ? 'Your account is paused' : 'Welcome back'),
        line: (gym, locked) => (locked
          ? `GEM has paused ${gym}'s account. Until it is reopened, your staff can sign in but cannot use GEM.`
          : `${gym}'s GEM account is open again. Everyone can carry on as before.`),
        why: 'Why', seeDue: 'See what is due', open: 'Open GEM',
      },
      reply: { eyebrow: 'GEM support', yourReport: 'Your report', status: 'Status', resolved: 'Resolved', inProgress: 'In progress', see: 'See it in GEM' },
      fromGem: 'From GEM',
    },
  },
  fr: {
    signInButton: 'Se connecter à GEM',
    orGoTo: (url) => `Ou allez sur ${url} et connectez-vous avec votre e-mail et votre mot de passe habituels.`,
    welcome: {
      subject: (gym) => `Votre compte ${gym} sur GEM`,
      preheader: (gym, code) => `Votre compte chez ${gym} est prêt. Code de la salle ${code}.`,
      eyebrow: 'Votre nouveau compte', title: (gym) => `Bienvenue chez ${gym}`,
      line: (gym) => `Un compte a été créé pour vous sur GEM, le système qu'utilise ${gym}. Voici comment y accéder.`,
      gymCode: 'Code de la salle', yourEmail: 'Votre e-mail', firstTime: 'Votre première connexion',
      steps: [
        'Ouvrez le bouton ci-dessus. Il connaît déjà votre salle.',
        'Saisissez votre e-mail et appuyez sur <strong style="color:#16161d;">Continuer</strong>.',
        'Comme c\'est votre première fois, on vous demande de <strong style="color:#16161d;">choisir un mot de passe</strong> (au moins 8 caractères).',
        'Saisissez le <strong style="color:#16161d;">code à 4 chiffres</strong> que votre responsable vous donne. Il prouve que le compte est bien le vôtre.',
        'Ensuite, le même écran vous demandera votre mot de passe.',
      ],
      alreadySet: 'S\'il vous demande un mot de passe au lieu de vous proposer d\'en créer un, votre compte est déjà prêt : utilisez <strong style="color:#16161d;">Mot de passe oublié</strong> sur cet écran.',
      noCode: 'Votre code à 4 chiffres n\'est jamais envoyé par e-mail ; demandez-le à votre responsable. Si vous n\'attendiez pas cet e-mail, vous pouvez l\'ignorer.',
    },
    task: {
      priorities: { high: 'Haute', medium: 'Moyenne', low: 'Basse' },
      aManager: 'Un responsable',
      given: (who, due) => `${who} vous a confié une tâche${due ? `, à faire pour le ${due}` : ''}.`,
      priority: 'Priorité', due: 'Échéance', from: 'De la part de', view: 'Se connecter pour la voir',
      subject: (gym, title) => `Nouvelle tâche chez ${gym} : ${title}`,
      preheader: (title, due) => `${title}${due ? `, pour le ${due}` : ''}`,
      eyebrow: 'Nouvelle tâche', title: 'Vous avez une nouvelle tâche',
      group: {
        line: (due) => `Le système a créé cette tâche pour la direction${due ? `, à faire pour le ${due}` : ''}. N'importe quel membre de la direction peut s'en occuper.`,
        assignedTo: 'Confiée à', management: 'Direction', raisedBy: 'Créée par', theSystem: 'Le système', review: 'Se connecter pour la traiter',
        subject: (gym, title) => `Tâche de direction chez ${gym} : ${title}`,
        eyebrow: 'Tâche pour la direction', title: 'Une tâche pour la direction',
      },
    },
    reset: {
      eyebrow: 'Mot de passe',
      byManager: {
        subject: (gym) => `Réinitialisez votre mot de passe pour ${gym} sur GEM`,
        preheader: 'Un lien pour choisir un nouveau mot de passe, valable 24 heures.', title: 'Choisissez un nouveau mot de passe',
        line: (sentBy, gym) => `${sentBy ? `${sentBy} vous a envoyé` : 'Voici'} un lien pour choisir un nouveau mot de passe pour votre compte chez ${gym}.`,
        button: 'Choisir un nouveau mot de passe',
        expires: '<strong style="color:#b4232a;">Ce lien expire dans 24 heures.</strong> Si vous ne l\'attendiez pas, ignorez cet e-mail : votre mot de passe ne change pas.',
      },
      forgot: {
        subject: 'Réinitialisez votre mot de passe GEM',
        preheader: 'Un lien pour choisir un nouveau mot de passe, valable 15 minutes.', title: 'Réinitialisez votre mot de passe',
        line: (gym) => `Nous avons reçu une demande de réinitialisation du mot de passe de votre compte ${gym} sur GEM. Appuyez sur le bouton pour en choisir un nouveau.`,
        button: 'Réinitialiser le mot de passe',
        expires: '<strong style="color:#b4232a;">Ce lien expire dans 15 minutes.</strong> Si vous avez demandé un autre lien après celui-ci, seul le plus récent fonctionne.',
        ignore: 'Si vous n\'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.',
      },
    },
    confirm: {
      subject: 'Confirmez votre adresse e-mail',
      preheader: 'Un clic pour confirmer votre adresse e-mail sur GEM.', eyebrow: 'Votre compte', title: 'Confirmez votre e-mail',
      line: 'Confirmez que cette adresse est bien la vôtre, pour que les liens de mot de passe et les avis de GEM vous parviennent.',
      button: 'Confirmer mon e-mail',
      valid: (days) => `Le lien est valable ${days} jours. Vous pouvez en demander un nouveau depuis GEM à tout moment.`,
    },
    newGym: {
      subject: (name) => `Bienvenue sur GEM, ${name} ! Votre salle est prête.`,
      preheader: (gym, code) => `${gym} est en ligne sur GEM. Le code de votre salle est ${code}.`,
      eyebrow: 'Votre salle est prête', title: (name) => `Bienvenue, ${name}`,
      line: (gym) => `Votre salle ${gym} est en ligne sur GEM. Gardez ces informations en lieu sûr.`,
      gymCode: 'Code de la salle', yourRole: 'Votre rôle', owner: 'Directeur général', signInEmail: 'E-mail de connexion',
      open: 'Ouvrir votre salle',
      steps: ['Ajoutez vos forfaits et vos prix dans les Paramètres.', 'Choisissez les moyens de paiement que vous acceptez.', 'Ajoutez votre personnel. Chacun reçoit un e-mail expliquant comment se connecter.'],
      notYou: 'Si vous n\'avez pas créé ce compte, vous pouvez ignorer cet e-mail.',
    },
    payroll: {
      subject: (gym, period) => `Salaires en retard chez ${gym} pour ${period}`,
      preheader: (count, period) => `${count} ${count === 1 ? 'employé attend sa' : 'employés attendent leur'} paie de ${period}.`,
      eyebrow: 'Salaires', title: 'Des salaires sont en retard',
      line: (gym, period) => `Chez ${gym}, des employés ont dépassé leur date de paie et attendent encore leur salaire pour ${period}.`,
      waiting: 'En attente de paiement', staff: (count) => (count === 1 ? 'employé' : 'employés'),
      button: 'Ouvrir GEM pour les payer',
      privacy: 'Par discrétion, cet e-mail ne contient ni noms, ni dates de paie, ni montants. Ils ne sont visibles que dans GEM.',
    },
    gem: {
      bill: {
        sent: { subject: (month, amount) => `Votre facture GEM de ${month} : ${amount}`, eyebrow: 'Votre facture GEM', title: (month, amount) => `${month} : ${amount}`, line: (gym, month) => `Voici ce que ${gym} doit à GEM pour ${month}.` },
        reminder: { subject: (month) => `Rappel : votre facture GEM de ${month} est à payer`, eyebrow: 'Rappel de paiement', title: (month, amount) => `${amount} à payer`, line: (gym, month) => `Votre facture GEM de ${month} n'est pas encore payée. Merci de la régler pour que votre compte reste ouvert.` },
        paid: { subject: (month, amount) => `Merci : GEM a reçu ${amount}`, eyebrow: 'Paiement reçu', title: () => 'Merci', line: (gym, month, amount) => `Nous avons reçu ${amount} pour la facture GEM de ${gym} de ${month}.` },
        paidLabel: 'Payé', due: 'Montant dû',
        month: 'Mois', members: 'Membres actifs', rate: 'Prix par membre',
        days: 'Jours facturés', daysOf: (n, of) => `${n} sur ${of} (après votre essai gratuit)`,
        discount: 'Remise', dueBy: 'À payer avant le',
        howToPay: 'Comment payer', replyToPay: 'Répondez à cet e-mail pour organiser le paiement.',
        see: 'Voir dans GEM',
      },
      lock: {
        subject: (gym, locked) => (locked ? `Votre compte GEM pour ${gym} est en pause` : `Votre compte GEM pour ${gym} est de nouveau ouvert`),
        preheader: (locked) => (locked ? 'Votre personnel ne peut pas utiliser GEM tant que le compte n\'est pas rouvert.' : 'Tout le monde peut de nouveau utiliser GEM.'),
        eyebrow: (locked) => (locked ? 'Compte en pause' : 'Compte ouvert'),
        title: (locked) => (locked ? 'Votre compte est en pause' : 'Bon retour'),
        line: (gym, locked) => (locked
          ? `GEM a mis en pause le compte de ${gym}. Tant qu'il n'est pas rouvert, votre personnel peut se connecter mais ne peut pas utiliser GEM.`
          : `Le compte GEM de ${gym} est de nouveau ouvert. Tout le monde peut continuer comme avant.`),
        why: 'Motif', seeDue: 'Voir ce qui est dû', open: 'Ouvrir GEM',
      },
      reply: { eyebrow: 'Support GEM', yourReport: 'Votre signalement', status: 'Statut', resolved: 'Résolu', inProgress: 'En cours', see: 'Voir dans GEM' },
      fromGem: 'De la part de GEM',
    },
  },
};

const languageOf = (staff) => staffLanguage(staff);
const textFor = (staff) => TEXT[languageOf(staff)];

module.exports = { TEXT, languageOf, textFor };
