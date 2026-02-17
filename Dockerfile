# Utiliser une image Node.js officielle légère
FROM node:18-alpine

# Créer le dossier de l'application
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier le reste des fichiers du projet
COPY . .

# Exposer le port sur lequel l'application tourne
EXPOSE 3000

# Commande de démarrage
CMD ["npm", "start"]
