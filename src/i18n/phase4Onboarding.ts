import type { Language } from '../domain'
import type { TranslationKey } from './types'

type Messages = Partial<Record<TranslationKey, string>>

export const phase4OnboardingMessages: Record<Language, Messages> = {
  en: {
    'onboarding.welcomeTitle': 'See the other side. Strengthen your own.',
    'onboarding.welcomeBody': 'SideShift is a private space to practice structured debate, test your reasoning, and understand a perspective before you answer it.',
    'onboarding.chooseModeTitle': 'Choose how you want to debate.',
    'onboarding.chooseModeBody': 'Start with the format that fits your moment. You can use every mode later.',
    'onboarding.modeBasicTitle': 'Debate AI', 'onboarding.modeBasicBody': 'SideShift Basic works without connecting Puter.',
    'onboarding.modePersonTitle': 'Challenge a person', 'onboarding.modePersonBody': 'Send a private challenge link and compare arguments asynchronously.',
    'onboarding.modeTeamTitle': 'Team Debate', 'onboarding.modeTeamBody': 'Share one device for a local, facilitator-led debate.',
    'onboarding.switchTitle': 'Try the other side on purpose.',
    'onboarding.switchBody': 'SideSwitch may ask you to defend the position you do not usually take. It is practice for better reasoning, stronger rebuttals, and fairer conversations.',
    'onboarding.switchExample': 'Example: instead of defending your own view, build the strongest case for the opposite side.',
    'onboarding.switchBenefits': 'More perspective · clearer thinking · better questions',
    'onboarding.personalizeTitle': 'Make the first debate yours.',
    'onboarding.personalizeBody': 'Choose a name and a few interests. These preferences stay private and help us show you useful takes.',
    'onboarding.startMyFirstDebate': 'Start my first debate', 'onboarding.skipShort': 'Skip for now', 'onboarding.progress': 'Introduction step {current} of {total}',
  },
  de: {
    'onboarding.welcomeTitle': 'Sieh die andere Seite. Stärke deine eigene.',
    'onboarding.welcomeBody': 'SideShift ist ein privater Ort, um strukturiertes Debattieren zu üben, dein Denken zu testen und Perspektiven zu verstehen.',
    'onboarding.chooseModeTitle': 'Wie möchtest du debattieren?', 'onboarding.chooseModeBody': 'Wähle das Format für jetzt. Später stehen dir alle Modi offen.',
    'onboarding.modeBasicTitle': 'Mit KI debattieren', 'onboarding.modeBasicBody': 'SideShift Basic funktioniert ohne Puter-Verbindung.',
    'onboarding.modePersonTitle': 'Person herausfordern', 'onboarding.modePersonBody': 'Sende einen privaten Link und vergleicht eure Argumente asynchron.',
    'onboarding.modeTeamTitle': 'Team Debate', 'onboarding.modeTeamBody': 'Debattiert lokal gemeinsam auf einem Gerät.',
    'onboarding.switchTitle': 'Übe bewusst die andere Seite.', 'onboarding.switchBody': 'SideSwitch kann dich auffordern, die Position zu verteidigen, die du sonst nicht einnimmst. So werden Argumente, Erwiderungen und Gespräche fairer.', 'onboarding.switchExample': 'Beispiel: Baue statt deiner eigenen Sicht das stärkste Argument für die Gegenseite.', 'onboarding.switchBenefits': 'Mehr Perspektive · klareres Denken · bessere Fragen',
    'onboarding.personalizeTitle': 'Mach die erste Debatte zu deiner.', 'onboarding.personalizeBody': 'Wähle einen Namen und einige Interessen. Diese Angaben bleiben privat und helfen bei passenden Takes.', 'onboarding.startMyFirstDebate': 'Meine erste Debatte starten', 'onboarding.skipShort': 'Jetzt überspringen', 'onboarding.progress': 'Einführungsschritt {current} von {total}',
  },
  fr: {
    'onboarding.welcomeTitle': 'Voyez l’autre côté. Renforcez le vôtre.', 'onboarding.welcomeBody': 'SideShift est un espace privé pour pratiquer le débat structuré, tester votre raisonnement et comprendre un point de vue.',
    'onboarding.chooseModeTitle': 'Comment voulez-vous débattre ?', 'onboarding.chooseModeBody': 'Choisissez le format qui vous convient maintenant. Les autres resteront disponibles.', 'onboarding.modeBasicTitle': 'Débattre avec l’IA', 'onboarding.modeBasicBody': 'SideShift Basic fonctionne sans connecter Puter.', 'onboarding.modePersonTitle': 'Défier une personne', 'onboarding.modePersonBody': 'Envoyez un lien privé et comparez vos arguments quand l’autre répond.', 'onboarding.modeTeamTitle': 'Team Debate', 'onboarding.modeTeamBody': 'Débattez localement sur un appareil partagé.',
    'onboarding.switchTitle': 'Essayez volontairement l’autre côté.', 'onboarding.switchBody': 'SideSwitch peut vous demander de défendre une position que vous ne prenez pas d’habitude. Vous entraînez ainsi votre raisonnement et des échanges plus justes.', 'onboarding.switchExample': 'Exemple : construisez le meilleur argument pour l’opinion opposée à la vôtre.', 'onboarding.switchBenefits': 'Plus de perspective · pensée plus claire · meilleures questions', 'onboarding.personalizeTitle': 'Faites de votre premier débat le vôtre.', 'onboarding.personalizeBody': 'Choisissez un nom et quelques centres d’intérêt. Ces préférences restent privées et servent à personnaliser vos sujets.', 'onboarding.startMyFirstDebate': 'Démarrer mon premier débat', 'onboarding.skipShort': 'Passer pour l’instant', 'onboarding.progress': 'Étape {current} sur {total}',
  },
  es: {
    'onboarding.welcomeTitle': 'Mira el otro lado. Fortalece el tuyo.', 'onboarding.welcomeBody': 'SideShift es un espacio privado para practicar debates estructurados, poner a prueba tu razonamiento y entender otras perspectivas.', 'onboarding.chooseModeTitle': 'Elige cómo quieres debatir.', 'onboarding.chooseModeBody': 'Empieza con el formato que encaje contigo. Después podrás usar todos.', 'onboarding.modeBasicTitle': 'Debate con IA', 'onboarding.modeBasicBody': 'SideShift Basic funciona sin conectar Puter.', 'onboarding.modePersonTitle': 'Desafía a una persona', 'onboarding.modePersonBody': 'Envía un enlace privado y compara argumentos cuando responda.', 'onboarding.modeTeamTitle': 'Team Debate', 'onboarding.modeTeamBody': 'Debatid en grupo con un dispositivo compartido.', 'onboarding.switchTitle': 'Prueba el otro lado a propósito.', 'onboarding.switchBody': 'SideSwitch puede pedirte defender una postura que normalmente no eliges. Así mejoras el razonamiento, las réplicas y la conversación justa.', 'onboarding.switchExample': 'Ejemplo: construye el mejor argumento para la postura contraria a la tuya.', 'onboarding.switchBenefits': 'Más perspectiva · pensamiento claro · mejores preguntas', 'onboarding.personalizeTitle': 'Haz tuyo el primer debate.', 'onboarding.personalizeBody': 'Elige un nombre y algunos intereses. Se mantienen privados y ayudan a mostrarte buenos temas.', 'onboarding.startMyFirstDebate': 'Empezar mi primer debate', 'onboarding.skipShort': 'Omitir por ahora', 'onboarding.progress': 'Paso {current} de {total}',
  },
  it: {
    'onboarding.welcomeTitle': 'Guarda l’altro lato. Rafforza il tuo.', 'onboarding.welcomeBody': 'SideShift è uno spazio privato per esercitarti nel dibattito, mettere alla prova il ragionamento e capire altre prospettive.', 'onboarding.chooseModeTitle': 'Scegli come vuoi dibattere.', 'onboarding.chooseModeBody': 'Inizia dal formato più adatto a te. Gli altri saranno sempre disponibili.', 'onboarding.modeBasicTitle': 'Dibatti con l’IA', 'onboarding.modeBasicBody': 'SideShift Basic funziona senza collegare Puter.', 'onboarding.modePersonTitle': 'Sfida una persona', 'onboarding.modePersonBody': 'Invia un link privato e confronta gli argomenti quando arriverà la risposta.', 'onboarding.modeTeamTitle': 'Team Debate', 'onboarding.modeTeamBody': 'Dibattete localmente su un dispositivo condiviso.', 'onboarding.switchTitle': 'Prova di proposito l’altro lato.', 'onboarding.switchBody': 'SideSwitch può chiederti di difendere una posizione che di solito non scegli. È pratica per ragionare meglio e conversare con più equità.', 'onboarding.switchExample': 'Esempio: costruisci l’argomento migliore per la posizione opposta alla tua.', 'onboarding.switchBenefits': 'Più prospettiva · pensiero più chiaro · domande migliori', 'onboarding.personalizeTitle': 'Rendi tuo il primo dibattito.', 'onboarding.personalizeBody': 'Scegli un nome e alcuni interessi. Restano privati e aiutano a proporti temi utili.', 'onboarding.startMyFirstDebate': 'Inizia il mio primo dibattito', 'onboarding.skipShort': 'Salta per ora', 'onboarding.progress': 'Passaggio {current} di {total}',
  },
}
