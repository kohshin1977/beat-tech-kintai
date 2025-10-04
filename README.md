# 勤怠管理 Web アプリ (Beat-Teck Kintai)

React + Firebase を用いた勤怠管理 Web アプリです。社員はスマートフォンから打刻・勤務内容の登録を行い、管理者は PC からリアルタイムの状況や月次サマリーを確認し、Excel / CSV 形式でエクスポートできます。

## プロジェクト構成

```
.
├── frontend/                 # React アプリケーション
│   ├── src/
│   │   ├── components/       # 共通 UI コンポーネント
│   │   ├── context/          # 認証コンテキスト
│   │   ├── hooks/            # 再利用可能なロジック
│   │   ├── pages/            # 画面コンポーネント (社員/管理者)
│   │   └── services/         # Firebase 連携ロジック
│   └── .env.example          # Firebase 設定テンプレート
└── functions/                # Firebase Cloud Functions (集計ロジックの雛形)
```

## セットアップ手順

1. **リポジトリの依存関係をインストール**
   ```bash
   cd frontend
   npm install
   ```
2. **環境変数ファイルを設定**
   `.env.example` を `.env.local` にコピーし、Firebase プロジェクトの設定値を入力してください。
   ```bash
   cp .env.example .env.local
   ```
3. **ローカル開発サーバーを起動**
   ```bash
   npm run dev
   ```
   ブラウザで `http://localhost:5173` を開くとアプリを確認できます。

## Firebase 設定

- **Authentication**: Email/Password を有効化してください。
- **Firestore**: 以下のコレクション構造を前提としています。
  - `users/{userId}` : `name`, `department`, `role` (`employee` or `admin`)
  - `users/{userId}/attendance/{YYYY-MM-DD}` : 打刻データ
  - `users/{userId}/monthlySummary/{YYYY-MM}` : 月次集計データ
- **Cloud Functions**: `functions/` ディレクトリに雛形を用意しています。`firebase deploy --only functions` でデプロイできます。

### Firestore セキュリティルール (抜粋例)

以下は参考例です。プロダクション投入前に要件に合わせて精査してください。

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if false; // 管理コンソールのみ
      allow create: if request.auth != null && request.auth.token.admin == true;

      match /attendance/{workDate} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /monthlySummary/{yearMonth} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null && request.auth.token.admin == true;
      }
    }

    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

## 主な機能

### 社員 (スマートフォン向け UI)
- Firebase Authentication によるログイン
- 出勤/退勤ワンタップ打刻
- 休憩時間・勤務内容の登録
- 当日勤務時間・リアルタイム残業時間の表示
- 月次サマリー、勤務履歴 (リスト/カレンダー表示)

### 管理者 (PC 向け UI)
- リアルタイムダッシュボード (勤務中/退勤済み/未出勤/残業超過)
- 任意日付の全社員勤怠一覧
- 月次サマリー表
- Excel(.xlsx) / CSV エクスポート (SheetJS 利用)

## 開発用コマンド

- `npm run dev` : Vite 開発サーバー起動
- `npm run build` : 本番ビルド
- `npm run preview` : ビルド成果物のプレビュー

## Cloud Functions

`functions/` フォルダに勤怠集計用の Cloud Functions の雛形を用意しています。ローカルでのテストやデプロイ方法は同ディレクトリの README を参照してください。

## 補足

- 200 名規模での利用を想定しており、クライアントは Firestore のリアルタイムリスナーを活用して最新状態を反映します。
- エクスポート機能では SheetJS を用いて Excel ファイルを生成し、FileSaver でクライアントダウンロードを行います。
- 本リポジトリでは UI/ロジックの実装を提供します。実運用には Firestore のインデックス設定、セキュリティルール、バックアップ、監査ログなどの整備も実施してください。
