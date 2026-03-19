class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }
    preload() {
        // darties.fr — bases Phaser : chargement de l'image de fond
        this.load.image('background', 'assets/space.jpg');
    }
    create() {
        const { width, height } = this.scale;

        // darties.fr — bases Phaser : afficher l'image de fond
        this.add.image(width / 2, height / 2, 'background').setDisplaySize(width, height);

        this.add.text(width / 2, height / 3, 'Gravity Fall', {
            fontSize: '72px', fontFamily: 'Arial Black',
            color: '#ffffff', stroke: '#4488ff', strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 3 + 90, 'Last Orbit', {
            fontSize: '28px', fontFamily: 'Arial',
            color: '#aaaaff', fontStyle: 'italic'
        }).setOrigin(0.5);

        const startText = this.add.text(width / 2, height * 0.65, 'Appuie sur ESPACE pour jouer', {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffffff'
        }).setOrigin(0.5);

        // darties.fr — tweens : clignotement du texte blanc
        this.tweens.add({ targets: startText, alpha: 0, duration: 800, yoyo: true, repeat: -1 });

        this.add.text(width / 2, height * 0.80,
            'ESPACE ou CLIC pour sauter entre les planètes\nSurvie avant que tout s\'effondre !', {
            fontSize: '16px', fontFamily: 'Arial', color: '#888888', align: 'center'
        }).setOrigin(0.5);

        const redText = this.add.text(width / 2, height * 0.55,
            'Dépeche toi de rejoindre le vaisseau afin de découvrire le mysterieux secret entre Trump et son ami Epstein', {
            fontSize: '25px', fontFamily: 'Arial', color: '#ff0000', align: 'center'
        }).setOrigin(0.5);

        // darties.fr — tweens : clignotement de la phrase rouge
        this.tweens.add({ targets: redText, alpha: 0, duration: 500, yoyo: true, repeat: -1 });

        // darties.fr — bases Phaser : écouter la touche ESPACE
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).once('down', () => {
            this.scene.start('GameScene', { level: 1 });
        });
        this.input.once('pointerdown', () => {
            this.scene.start('GameScene', { level: 1 });
        });
    }
    update() {}
}