# Vinted → Beebs - Export en 1 clic 👶⚡️

Extension Chrome + Script Tampermonkey pour exporter tes annonces Vinted vers **Beebs (Beebs by Kiabi)** en 1 clic.

Même principe que [Vinted → Leboncoin](https://github.com/ValentinGratz/vinted2leboncoin-) mais pour l'univers enfant / seconde main famille.

> ⚠️ **Important :** Beebs ne permet officiellement de vendre que depuis l'application mobile. Cette extension ne poste pas directement (API non publique pour la V1). Elle **prépare et copie tout** pour que tu n'aies qu'à coller dans l'app Beebs en 10 secondes.

> ⚠️ **Tu utilises CCleaner / BleachBit ?** Lis [ATTENTION_CCLEANER_BLEACHBIT.md](https://github.com/ValentinGratz/vinted2beebs/blob/main/ATTENTION-CCLEANER-BLEACHBIT.md) sinon tu vas perdre tes données.
---

## 🚀 Fonctionnalités

- Bouton **"⚡️ Exporter vers Beebs"** injecté directement sur chaque page annonce Vinted
- Extraction auto :
  - Titre (tronqué à 40 caractères, limite Beebs)
  - Description complète + Marque / Taille / État
  - Prix Vinted + prix conseillé (+10% pour couvrir la commission Beebs)
  - Photos HD (max 10)
- Panneau flottant :
  - Copier titre / description / prix en 1 clic
  - Télécharger photos une par une ou toutes d'un coup
  - Bouton "Ouvrir Beebs + Copier tout" → ouvre beebs.app avec tout dans le presse-papier

100% local, open source, aucune donnée envoyée.

---

## 📦 Installation

### Option 1 : Extension Chrome (recommandée - stable)

1. Télécharge le ZIP : `dist/vinted-to-beebs.zip`
2. Dézippe
3. Va sur `chrome://extensions/` → active **Mode développeur** en haut à droite
4. **Charger l'extension non empaquetée** → sélectionne le dossier dézippé
5. Va sur Vinted.fr → le bouton apparaît

**CRX :** `dist/vinted-to-beebs.crx` → glisse-dépose le fichier sur la page `chrome://extensions/`

### Option 2 : Tampermonkey (la plus simple - 10 sec)

1. Installe l'extension [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) sur Chrome
2. Clique sur l'icône Tampermonkey → **Créer un nouveau script**
3. Supprime tout et colle le contenu de `Tampermonkey/Vinted-To-Beebs-User.js`
4. Ctrl+S
5. Va sur Vinted → le bouton apparaît

Lien direct raw pour install auto :
`https://github.com/ValentinGratz/vinted2beebs/blob/main/Tampermonkey/Vinted-To-Beebs-User.js`

---

## ⚙️ Comment ça marche ?

1. Va sur ton annonce Vinted
2. Clique sur **"⚡️ Exporter vers Beebs"** sous le titre
3. Dans le panneau jaune à droite :
   - Copie titre / description / prix
   - Clique "Télécharger toutes les photos"
4. Ouvre l'app Beebs → Créer → Colle tout + ajoute les photos

30 secondes au lieu de 5 minutes par annonce.

---

## 🗺️ Roadmap

- [x] V1 - Tampermonkey + Extension Chrome (copier/coller semi-auto)
- [ ] V2 - Full auto via API `api.beebs.app` (reverse de l'app Android - besoin de token)
- [ ] V3 - Mode rafale : exporter tout un profil Vinted d'un coup
- [ ] Mapping catégories intelligent (Vinted -> catégories Beebs : 0-1 mois, 3 mois, etc.)

---

## 🤝 Besoin de testeurs

Si tu testes la version Tampermonkey, dis-moi si le bouton s'affiche bien et si les photos HD sont bien récupérées.

Idées bienvenues en Issues !

## 📄 Licence

MIT - Gratuit pour les resellers

---

**Repo lié :** Vinted → Leboncoin : https://github.com/ValentinGratz/vinted2leboncoin-
**Auteur :** [@ValentinGratz](https://github.com/ValentinGratz)
