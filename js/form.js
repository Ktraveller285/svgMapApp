/* * 登録ボタンを押したときの処理
 */
document.getElementById("btn-open-post").addEventListener("click", function () {
  // 1. 座標情報の取得
  // 画面上の #centerPos という要素から緯度経度を取得する
  const centerPosElement = document.querySelector("#centerPos");
  const centerPosText = centerPosElement ? centerPosElement.innerText : "";

  console.log("取得した座標テキスト:", centerPosText);

  // 2. 座標のパース（数値の抽出）
  // 文字の中から数字（例: 135.123 や 35.678）を探す
  const coords = centerPosText.match(/-?\d+(\.\d+)?/g);

  let lat = "";
  let lon = "";

  if (coords && coords.length >= 2) {
    const val1 = parseFloat(coords[0]);
    const val2 = parseFloat(coords[1]);

    // 日本付近の座標と仮定して、大きい数字を経度(lon)、小さい数字を緯度(lat)に振り分ける
    if (val1 > val2) {
      lon = val1;
      lat = val2;
    } else {
      lat = val1;
      lon = val2;
    }
  } else {
    alert(
      "座標が取得できませんでした。\n画面内の #centerPos 要素を確認してください。"
    );
    return;
  }

  // 3. フォームへの自動入力
  // 取得した数値を入力欄にセット
  document.getElementById("input-lat").value = lat;
  document.getElementById("input-lon").value = lon;

  // 4. 投稿画面（モーダル）を表示する
  document.getElementById("post-modal").style.display = "flex";
});

/*
 * キャンセルボタンを押したときの処理
 */
document.getElementById("btn-cancel").addEventListener("click", function () {
  document.getElementById("post-modal").style.display = "none";
});
