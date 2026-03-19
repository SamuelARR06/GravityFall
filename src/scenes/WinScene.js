class WinScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WinScene' });
    }
    init(data) {
        this.finalTime = data.time || 0;
    }
    preload() {
        // bases Phaser : chargement de l'image de fond
        this.load.image('win_bg', 'assets/win.jpeg');
    }
    create() {
        const { width, height } = this.scale;

        // image de fond
        this.add.image(width / 2, height / 2, 'win_bg').setDisplaySize(width, height);

        this.add.text(width / 2, height * 0.25, 'VOUS AVEZ Découvert que Trump et Epstein sont les meilleurs amis ! ', {
            fontSize: '30px', fontFamily: 'Arial Black',
            color: '#44ff88', stroke: '#006633', strokeThickness: 5
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.65, `Temps : ${this.finalTime} secondes`, {
            fontSize: '28px', fontFamily: 'Arial', color: '#006633'
        }).setOrigin(0.5);

        const replayText = this.add.text(width / 2, height * 0.78, 'Appuie sur ESPACE pour rejouer', {
            fontSize: '22px', fontFamily: 'Arial', color: '#aaaaff'
        }).setOrigin(0.5);

        // clignotement
        this.tweens.add({ targets: replayText, alpha: 0, duration: 700, yoyo: true, repeat: -1 });

        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).once('down', () => this.scene.start('MenuScene'));
        this.input.once('pointerdown', () => this.scene.start('MenuScene'));
    }
    update() {}
}