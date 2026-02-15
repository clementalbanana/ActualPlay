# 🎲 ActualPlay Dashboard

**ActualPlay Dashboard** est une application web complète conçue pour faciliter la gestion et l'affichage d'une partie de Jeu de Rôle sur table (JdR/TTRPG) diffusée en direct (Twitch, YouTube).

Elle permet de connecter en temps réel les interfaces des **Joueurs**, du **Maître du Jeu (MJ)** et un **Overlay** pour OBS/XSplit via WebSockets.

## ✨ Fonctionnalités

### 🛡️ Interface Joueur
*   **Fiche de Personnage :** Gestion des PV (Barre de vie), Armure, Or.
*   **Statistiques Personnalisées :** Ajout dynamique de compteurs (Mana, Points de Ki, Munitions, etc.) via un formulaire intuitif.
*   **Panier de Dés :** Système de "Dice Tray" permettant de préparer une poignée de dés (ex: 2d6 + 1d8) et de tout lancer en une fois.
*   **Sauvegarde de Session :** Le personnage est lié à la session du navigateur.

### 👑 Interface Maître du Jeu (MJ)
*   **Gestion du Boss :** Contrôle en temps réel du nom, de l'armure et des PV du Boss affiché à l'écran.
*   **Lancer de Dés MJ :** Panier de dés identique aux joueurs pour les jets du MJ.
*   **Projection d'Images :** Upload et affichage d'images (PNJ, Lieux, Indices) directement sur l'overlay.
*   **Journal des Logs :** Historique de tous les lancers de dés effectués par les joueurs et le MJ.

### 📺 Overlay (Stream)
*   **Design Transparent :** Fond transparent prêt à être intégré comme "Source Navigateur" dans OBS.
*   **Mise à jour Temps Réel :** Les barres de vie et stats bougent instantanément.
*   **Notifications de Dés :** Affichage visuel des résultats de dés (Total + Détails) au centre de l'écran.
*   **Affichage Dynamique :** Les fiches des joueurs s'ajoutent et se retirent automatiquement selon la connexion.

## 🚀 Installation

1.  **Prérequis :** Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé sur votre machine.
2.  **Cloner le projet :**
    ```bash
    git clone https://github.com/votre-utilisateur/ActualPlay.git
    cd ActualPlay
    ```
3.  **Installer les dépendances :**
    ```bash
    npm install
    ```
4.  **Lancer le serveur :**
    ```bash
    node server.js
    ```

## 🎮 Utilisation

Une fois le serveur lancé (par défaut sur le port 3000), ouvrez votre navigateur :

*   **Interface Joueur :** `http://localhost:3000/` (À ouvrir sur les téléphones/PC des joueurs)
*   **Interface MJ :** `http://localhost:3000/gm.html` (À ouvrir sur l'écran du MJ)
*   **Overlay :** `http://localhost:3000/overlay.html` (À ne pas ouvrir directement, voir section OBS)

## 🎥 Intégration OBS / Streamlabs

1.  Dans OBS, ajoutez une nouvelle source : **Navigateur (Browser Source)**.
2.  Nommez-la "Overlay JdR".
3.  Dans le champ URL, mettez : `http://localhost:3000/overlay.html`
4.  Définissez la taille (Largeur x Hauteur) correspondant à votre canvas (ex: `1920` x `1080`).
5.  Cochez la case "Rafraîchir le cache de la page actuelle".
6.  Validez. L'overlay est maintenant superposé à votre caméra/jeu !

## 🛠️ Technologies Utilisées

*   **Backend :** Node.js, Express
*   **Temps Réel :** Socket.io
*   **Frontend :** HTML5, JavaScript (Vanilla)
*   **Styles :** Tailwind CSS (via CDN), CSS3 (Animations)
*   **Uploads :** Multer

## 📄 Licence

Ce projet est sous licence MIT. Vous êtes libre de le modifier et de l'utiliser pour vos propres streams.
