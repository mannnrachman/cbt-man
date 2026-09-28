let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let alarmTimer: ReturnType<typeof setTimeout> | null = null;

export function armExamAlarm(): void {
	if (typeof window === "undefined" || audioCtx) return;
	const Ctx = window.AudioContext;
	if (!Ctx) return;
	audioCtx = new Ctx();
	if (audioCtx.state === "suspended") {
		void audioCtx.resume();
	}
}

export function stopExamAlarm(): void {
	if (alarmTimer) {
		clearTimeout(alarmTimer);
		alarmTimer = null;
	}
	if (oscillator) {
		try {
			oscillator.stop();
			oscillator.disconnect();
		} catch {
			/* already stopped */
		}
		oscillator = null;
	}
}

export function startExamAlarm(durationMs: number = 3000): void {
	if (oscillator) return;
	if (!audioCtx) armExamAlarm();
	if (!audioCtx) return;
	if (audioCtx.state === "suspended") {
		void audioCtx.resume();
	}
	try {
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.type = "square";
		osc.frequency.value = 880;
		gain.gain.value = 0.06;
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.start();
		oscillator = osc;

		if (durationMs > 0) {
			alarmTimer = setTimeout(() => {
				stopExamAlarm();
			}, durationMs);
		}
	} catch {
		/* audio playback blocked or unavailable */
	}
}
