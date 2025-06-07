# Whisper Web

## English

Whisper-web is a webapplication that allows you to transcribe sound files to text completely locally in your web browser.

![A screenshot of the application](./screenshot.png)

This repository is a fork of [PierreMesure/whisper-web](https://github.com/PierreMesure/whisper-web), which is itself a fork of [Xenova/whisper-web](https://github.com/xenova/whisper-web).

Here are the main differences:

- Actively maintained
- Up-to-date dependencies, including transformers.js
- Ability to use WebGPU or CPU
- More user-friendly interface
- User interface in several languages
- Available as a progressive web app (so usable offline if added to your homescreen)
- Transcription is rendered continuously and not at the end
- Export to SRT
- Choose between a larger range of models (for example Swedish and Norwegian finetunes from the countries' national libraries)
- Choose your own quantization level for the model
- Clear cache with a button

The main application is available at [whisper-web.pascal-mietlicki.fr](https://whisper-web.pascal-mietlicki.fr/).

## Français

Whisper-web est une application web qui vous permet de transcrire des fichiers audio en texte complètement localement dans votre navigateur web.

Ce dépôt est un fork de [PierreMesure/whisper-web](https://github.com/PierreMesure/whisper-web), qui est lui-même un fork de [Xenova/whisper-web](https://github.com/xenova/whisper-web).

Voici les principales différences :

- Activement maintenu
- Dépendances à jour, incluant transformers.js
- Capacité d'utiliser WebGPU ou CPU
- Interface plus conviviale
- Interface utilisateur en plusieurs langues
- Disponible comme application web progressive (utilisable hors ligne si ajoutée à votre écran d'accueil)
- Transcription rendue en continu et non à la fin
- Export vers SRT
- Choix parmi une plus large gamme de modèles (par exemple les modèles suédois et norvégiens affinés par les bibliothèques nationales)
- Choisissez votre propre niveau de quantification pour le modèle
- Effacer le cache avec un bouton

L'application principale est disponible sur [whisper-web.pascal-mietlicki.fr](https://whisper-web.pascal-mietlicki.fr/).

## Running locally

1. Clone the repo and install dependencies:

    ```bash
    git clone https://github.com/pmietlicki/whisper-web.git
    cd whisper-web
    npm install
    ```

2. Run the development server:

    ```bash
    npm run dev
    ```

3. Open the link (e.g., [http://localhost:5173/](http://localhost:5173/)) in your browser.
