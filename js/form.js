// 1. Firebase SDK の読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBAJjnZj-TVSD7lzLjJGPnbzHcSdJ5D4dk",
  authDomain: "denlabo-svgmap-exp.firebaseapp.com",
  projectId: "denlabo-svgmap-exp",
  storageBucket: "denlabo-svgmap-exp.firebasestorage.app",
  messagingSenderId: "74174609992",
  appId: "1:74174609992:web:df2a5d17f215f74d1df67d",
};

// Firebase アプリを初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. 登録ボタンを押したときの処理（座標取得＆画面表示）
document.getElementById("btn-open-post").addEventListener("click", function () {
  const centerPosElement = document.querySelector("#centerPos");
  const centerPosText = centerPosElement ? centerPosElement.innerText : "";
  const matches = centerPosText.match(/-?\d+(\.\d+)?/g);

  let lat = "";
  let lon = "";

  if (matches) {
    let candidateLat = null;
    let candidateLon = null;

    // 緯度経度が日本の範囲に入っているかのチェック
    matches.forEach((strVal) => {
      const val = parseFloat(strVal);
      if (val >= 20 && val <= 46) {
        if (!candidateLat || strVal.includes(".")) candidateLat = val;
      }
      if (val >= 120 && val <= 155) {
        if (!candidateLon || strVal.includes(".")) candidateLon = val;
      }
    });

    if (candidateLat && candidateLon) {
      lat = candidateLat;
      lon = candidateLon;
    } else if (matches.length >= 2) {
      const val1 = parseFloat(matches[0]);
      const val2 = parseFloat(matches[1]);
      if (val1 > val2) {
        lon = val1;
        lat = val2;
      } else {
        lat = val1;
        lon = val2;
      }
    }
  }

  // フォームに値をセット
  document.getElementById("input-lat").value = lat;
  document.getElementById("input-lon").value = lon;

  // 日時の初期値（現在時刻）
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("input-date").value = now.toISOString().slice(0, 16);

  // 画面を表示
  document.getElementById("post-modal").style.display = "flex";
});

// 3. キャンセルボタン
document.getElementById("btn-cancel").addEventListener("click", function () {
  document.getElementById("post-modal").style.display = "none";
});

// 4. 登録するボタン（Firestoreへの送信処理）
document
  .getElementById("btn-submit")
  .addEventListener("click", async function () {
    // 入力値を取得
    const latStr = document.getElementById("input-lat").value;
    const lonStr = document.getElementById("input-lon").value;
    const dateStr = document.getElementById("input-date").value;
    const comment = document.getElementById("input-comment").value;

    // バリデーション
    if (!latStr || !lonStr || !dateStr) {
      alert("座標と日時は必須です。");
      return;
    }

    // 二重送信防止のためボタンを無効化
    const submitBtn = document.getElementById("btn-submit");
    submitBtn.disabled = true;
    submitBtn.innerText = "送信中...";

    try {
      // Firestore の "sightings" コレクションに追加
      await addDoc(collection(db, "sightings"), {
        latitude: parseFloat(latStr),
        longitude: parseFloat(lonStr),
        sightedAt: new Date(dateStr), // Timestamp型として保存
        comment: comment,
        createdAt: serverTimestamp(),
      });

      // 成功メッセージ
      alert("報告ありがとうございました。\n数分以内に地図に反映されます。");
      document.getElementById("post-modal").style.display = "none";

      // 入力欄をクリア
      document.getElementById("input-comment").value = "";
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("送信に失敗しました。\n" + error.message);
    } finally {
      // ボタンを元に戻す
      submitBtn.disabled = false;
      submitBtn.innerText = "登録する";
    }
  });
