/*
 * Public configuration only. Never place a GitHub token in this file.
 * The private ledger repository is entered on the page at login time.
 */
window.APP_CONFIG = Object.freeze({
  DATA_BRANCH: "main",
  STATE_PATH: "state.json",
  APP_TITLE: "我们的早睡养肤小约定",

  // Edit these rewards freely. A cryptographically secure browser RNG picks one.
  REWARDS: Object.freeze({
    SSR: Object.freeze([
      "ALASTIN Skincare Restorative Skin Complex"
    ]),
    SR: Object.freeze([
      "200 元以内的小礼物一件",
      "宝宝挑选的一次甜蜜小惊喜"
    ]),
    R: Object.freeze([
      "抱抱五分钟",
      "认真夸夸一次",
      "睡前故事一个",
      "明天主动提醒喝水",
      "十分钟放松按摩"
    ])
  })
});
