// 1. Firebase SDK の読み込み
// Authentication機能を追加でインポートしています
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firebase設定 (※ご自身の元の設定を使用してください)
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
const auth = getAuth(app); // Authの初期化

// ========================================================
// A. 認証状態の監視と画面切り替え
// ========================================================
onAuthStateChanged(auth, (user) => {
  const panelLogin = document.getElementById("panel-login");
  const panelForm = document.getElementById("panel-form");
  const userNameSpan = document.getElementById("user-display-name");

  // 要素が存在しない場合のエラー回避
  if (!panelLogin || !panelForm) return;

  if (user) {
    // === ログイン中 ===
    panelLogin.style.display = "none";
    panelForm.style.display = "block";

    // ユーザー名表示（もしHTMLに要素があれば）
    if (userNameSpan) {
      userNameSpan.textContent = user.displayName || "ユーザー";
    }
  } else {
    // === 未ログイン ===
    panelLogin.style.display = "block";
    panelForm.style.display = "none";
  }
});

// ========================================================
// B. 認証関連ボタンのイベント
// ========================================================

// Googleログインボタン
const btnLoginGoogle = document.getElementById("btn-login-google");
if (btnLoginGoogle) {
  btnLoginGoogle.addEventListener("click", async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // 成功すると onAuthStateChanged が動いて画面が切り替わります
    } catch (error) {
      console.error("Login Error:", error);
      alert("ログインに失敗しました: " + error.message);
    }
  });
}

// ログアウトボタン
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    signOut(auth).then(() => {
      alert("ログアウトしました");
    });
  });
}

// ログインパネル側のキャンセルボタン
const btnLoginCancel = document.getElementById("btn-login-cancel");
if (btnLoginCancel) {
  btnLoginCancel.addEventListener("click", function () {
    document.getElementById("post-modal").style.display = "none";
  });
}

// ========================================================
// C. 既存のモーダル表示処理（座標取得など）
// ========================================================
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
  // ※ここで中身が「ログイン画面」か「フォーム」かは、onAuthStateChangedによって自動制御されます
  document.getElementById("post-modal").style.display = "flex";
});

// ========================================================
// D. キャンセル＆登録ボタン処理
// ========================================================

// キャンセルボタン
document.getElementById("btn-cancel").addEventListener("click", function () {
  document.getElementById("post-modal").style.display = "none";
});

// 登録するボタン（Firestoreへの送信処理）
document
  .getElementById("btn-submit")
  .addEventListener("click", async function () {
    // ★追加: ログインチェック
    const user = auth.currentUser;
    if (!user) {
      alert("投稿するにはログインが必要です。");
      return;
    }

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
        userId: user.uid, // ★追加: ユーザーIDを記録
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
