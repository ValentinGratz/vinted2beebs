# ⚠️ ATTENTION - CCleaner / BleachBit / Nettoyeurs

## Pourquoi ce fichier ?

Si tu utilises **CCleaner, BleachBit, Avast Cleanup, AVG TuneUp, PrivaZer, Glary Utilities** ou tout autre nettoyeur, **tes scripts Vinted peuvent s'arrêter de fonctionner ou perdre leurs données**.

Ces logiciels suppriment par défaut :
- Les cookies (`vinted.fr` / `vinted.com`) → tu es déconnecté
- Le `Local Storage` → l'extension perd ses paramètres / cache
- Le stockage `Tampermonkey` → tes sauvegardes disparaissent
- Le cache navigateur → Vinted doit tout recharger

---

## 🛡️ Comment protéger tes scripts Vinted

### 1. Pour l'extension Chrome / Edge (recommandé)
L'extension est PLUS résistante que Tampermonkey car elle utilise `chrome.storage.local`.

**CCleaner :**
1. Options > Cookies > Cherche `vinted.fr` et `vinted.com` > Clique sur `Garder`
2. Dans `Nettoyage personnalisé` > Décoche `Stockage local` et `Stockage des sessions` pour Chrome/Edge

**BleachBit :**
1. Décoche `Cookies` et `Local Storage` et `DOM Storage`
2. Ou mieux : ajoute Vinted en Whitelist (Préférences > Whitelist)

### 2. Pour Tampermonkey (le plus fragile)
Tampermonkey stocke tout dans un dossier que CCleaner adore effacer.

**À FAIRE ABSOLUMENT :**
- **CCleaner > Applications > Décoche `Tampermonkey`**
- **BleachBit > Décoche `Tampermonkey` et `Greasemonkey`**
- Dans Tampermonkey > Tableau de bord > Paramètres > Active `Mode de stockage : Local + Sync` si tu as un compte

**Bouton de secours intégré dans mes scripts v1.6.3+ :**
- Clic droit sur l'icône Tampermonkey > Tableau de bord > Clique sur ton script Vinted
- Menu Tampermonkey > `📦 Exporter sauvegarde Vinted` / `📥 Importer sauvegarde`

### 3. Sauvegarde manuelle (recommandé pour tout le monde)
Dans chaque script, j'ai ajouté :
- `Export` → télécharge un fichier `vinted-backup-2026-08-17.json`
- `Import` → restaure tout en 1 clic

**Fais un export 1x par semaine si tu as +1000 favoris.**

---

## ❓ J'ai déjà tout perdu, que faire ?

1. Ne panique pas, Vinted n'a rien perdu, juste ton navigateur
2. Reconnecte-toi sur Vinted
3. Si tu avais fait un Export : Menu Tampermonkey > Importer
4. Si tu n'avais pas d'export : le script va rescanner depuis zéro, c'est juste plus long

## 🧪 Comment tester si CCleaner casse tout ?

1. Va sur Vinted > F12 > Console > Tape `localStorage.length` → tu dois avoir un chiffre > 0
2. Lance CCleaner
3. Re-tape `localStorage.length` → si c'est 0, il a tout effacé → Mets Vinted en whitelist.

---

> Créé pour https://github.com/ValentinGratz/Vinted-favorites-manager-
> Si tu as un autre nettoyeur qui casse le script, ouvre une Issue et je l'ajouterai ici.
