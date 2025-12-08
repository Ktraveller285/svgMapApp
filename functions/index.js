/**
 * 熊目撃情報マップ バックエンド処理 (初期実装版)
 * 仕様書: 3. 処理のフローとアーキテクチャ に準拠
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const axios = require("axios");
const FormData = require("form-data");

// Firebase Admin SDK の初期化
initializeApp();

// データベースとストレージの参照を取得
const db = getFirestore();
const storage = getStorage();

/**
 * 熊目撃情報が登録されたら実行される関数
 * トリガー: Firestore の sightings コレクションへの新規作成
 */
exports.generateMapLayer = onDocumentCreated(
  "sightings/{docId}",
  async (event) => {
    console.log("新規データの登録を検知しました。SVG生成処理を開始します。");

    try {
      // =========================================================
      // 1. Firestore から全データを取得する
      // =========================================================
      const snapshot = await db.collection("sightings").get();

      if (snapshot.empty) {
        console.log("データが存在しません。処理を終了します。");
        return;
      }

      // =========================================================
      // 2. データを CSV 形式に変換する
      // =========================================================
      // 仕様書 4.1 に従い、ヘッダー行を作成
      let csvContent = "latitude,longitude,comment,sightedAt\n";

      snapshot.forEach((doc) => {
        const data = doc.data();

        // 各フィールドの取得
        const lat = data.latitude;
        const lon = data.longitude;
        // CSVフォーマットを壊さないよう、改行やカンマを除去
        const comment = (data.comment || "").replace(/[\n,]/g, " ");

        // 日時の整形 (FirestoreのTimestamp型を日付文字列に変換)
        let dateStr = "";
        if (data.sightedAt && data.sightedAt.toDate) {
          dateStr = data.sightedAt.toDate().toLocaleString("ja-JP");
        } else {
          dateStr = new Date().toLocaleString("ja-JP");
        }

        // 行を追加
        csvContent += `${lat},${lon},${comment},${dateStr}\n`;
      });

      console.log("CSVデータの作成完了");
      // デバッグ用: 作成されたCSVの中身をログに出しておく（調査に役立ちます）
      console.log(csvContent);

      // =========================================================
      // 3. 外部API (SVGMapTools) へ CSV を送信して SVG を取得する
      // =========================================================
      // 仕様書 4. SVGMapTools API の仕様 に準拠
      const apiUrl =
        "https://svgmaptools-api-74174609992.us-west1.run.app/shape2svgmap";

      const form = new FormData();
      // API仕様に従い、'csv' というキーでファイルデータを送信
      form.append("csv", Buffer.from(csvContent), {
        filename: "data.csv",
        contentType: "text/csv",
      });

      console.log("APIへリクエストを送信中...");

      // POSTリクエスト送信
      const apiResponse = await axios.post(apiUrl, form, {
        headers: {
          ...form.getHeaders(),
        },
        responseType: "text", // SVGテキストを受け取る
      });

      const svgData = apiResponse.data;
      console.log("SVGデータの生成に成功しました。");

      // =========================================================
      // 4. 生成された SVG を Cloud Storage へアップロードする
      // =========================================================
      // 保存先バケットを取得
      const bucket = storage.bucket();
      // 保存ファイル名: layer_sightings.svg
      const file = bucket.file("layer_sightings.svg");

      await file.save(svgData, {
        contentType: "image/svg+xml",
        metadata: {
          // ブラウザ等でのキャッシュを制御（頻繁に更新されるため短めに）
          cacheControl: "public, max-age=60",
        },
      });

      console.log(
        "Cloud Storage へのアップロードが完了しました: layer_sightings.svg"
      );
    } catch (error) {
      console.error("エラーが発生しました:", error.message);
      if (error.response) {
        console.error("APIステータス:", error.response.status);
        console.error("APIレスポンス:", error.response.data);
      }
    }
  }
);
