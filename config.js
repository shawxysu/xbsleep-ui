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
      "宝宝挑选的一次甜蜜小惊喜"
    ]),
    R: Object.freeze([
      "今天早睡辛苦啦",
      "明天继续加油早睡哦",
      "宝宝已经很棒啦",,
      "早睡努力被看见啦",
      "今晚做得很好哟"
    ])
  })
});
