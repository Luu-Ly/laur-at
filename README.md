# Vote du jury : 1ère Journée de Recherche du CH de Mayotte

Une page web de vote (Vercel + base Redis Upstash) : connexion par initiales, vote anonyme,
décompte automatique, et une page publique `/resultats` qui affiche « LP a voté » puis les lauréats.
Pas de page d'administration, pas de PDF.

## Règles
- **A** : le juré classe ses 3 meilleurs abstracts (1er = 3 pts, 2e = 2 pts, 3e = 1 pt). Seuls 3 clics sont possibles.
  Lauréat = le plus de points ; en cas d'égalité, les ex æquo sont tous lauréats.
- **B** : un seul abstract ; lauréat = le plus de voix (ex æquo = tous lauréats).
- **C** : « Récompenser » (1) ou « Vote blanc » (0) ; récompensé si « récompenser » > votes blancs.
- Chaque juré saisit ses initiales ; `/resultats` affiche « LP a voté ». Quand 12 jurés ont voté, les lauréats
  des 3 catégories et le détail des points s'affichent (aucun bulletin individuel).
- Vote définitif, un seul par juré, **bulletin anonyme** (ni identifiant, ni initiales, ni horodatage).

## Mise en ligne sur Vercel
1. GitHub : créez un dépôt, puis **Add file → Upload files** : déposez le CONTENU de ce dossier (pas le .zip),
   et cliquez sur **Commit changes**. `package.json` doit se trouver à la racine du dépôt.
2. Vercel → **Add New → Project** → importez le dépôt (Framework : *Other*) → Deploy.
3. Projet Vercel → **Storage** → ajoutez **Upstash Redis** et connectez-le au projet
   (les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` se créent seules).
4. **Settings → Environment Variables** : ajoutez `SESSION_SECRET` (chaîne aléatoire de 32 caractères ou plus), seule variable obligatoire.
   Facultatif : `ACCESS_CODE` (code commun), `ELECTION_ID`, `JURY_SIZE`.
5. **Settings → Deployment Protection** : désactivez « Vercel Authentication » pour que les jurés puissent accéder au site.
6. **Redéployez** (Deployments → ⋯ → Redeploy).

Adresses : les jurés votent sur `https://votre-site.vercel.app/`, l'écran de la salle est
`https://votre-site.vercel.app/resultats`.

## Les jurés (connexion par initiales, sans mot de passe)
Les 12 jurés se connectent avec leurs seules initiales : AC, LP, MN, NT, PB, OR, MK, SM, CB, AG, MD, PF
(liste dans `lib/config.js`). Aucune fiche, aucun mail à envoyer.

Limite à connaître : quiconque connaît l'adresse du site et les initiales d'un juré peut voter à sa place, et si
quelqu'un vote avant lui sous ses initiales, le vrai juré ne peut plus voter. Parade facultative : définir la
variable `ACCESS_CODE` (un code unique, annoncé oralement ou affiché en salle) ; il est alors demandé à la connexion.
Le vote étant anonyme, un vote enregistré ne peut pas être annulé individuellement : seule la remise à zéro
(ci-dessous) efface tout.

## Repartir d'une urne vide
Variable d'environnement facultative `ELECTION_ID` (par défaut `1`). Changez sa valeur (par exemple `officiel`),
puis redéployez : le décompte repart à zéro sans rien supprimer.

## Modifier les abstracts
Tout est dans `lib/config.js` (liste, titres, barème, `JURY_SIZE`). À vérifier : l'absence de `2026-A-011`
et le numéro `2026-C-001`.

## Tests locaux
`npm install` puis `npm test`. `npm run dev` lance le site en local (http://localhost:3000, stockage en mémoire).
