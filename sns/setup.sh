#!/bin/bash
# SNS Server Setup Script
# Ubuntu Server向けセットアップ

set -e

echo "=== SNS セットアップ開始 ==="

# 1. パッケージ更新・インストール
sudo apt-get update -y
sudo apt-get install -y apache2 php php-sqlite3 php-mbstring php-curl sqlite3 unzip

# 2. Apacheモジュール有効化
sudo a2enmod rewrite

# 3. DBディレクトリ作成（Webルート外）
sudo mkdir -p /var/www/sns_data/db
sudo chown www-data:www-data /var/www/sns_data/db
sudo chmod 755 /var/www/sns_data/db

# 4. アプリファイルをWebルートに配置
sudo mkdir -p /var/www/html/sns/api
sudo cp -r public/* /var/www/html/sns/
sudo cp -r api/* /var/www/html/sns/api/

# 5. データベース初期化
sudo -u www-data sqlite3 /var/www/sns_data/db/OrderManage.db < db/init.sql
sudo chown www-data:www-data /var/www/sns_data/db/OrderManage.db
sudo chmod 664 /var/www/sns_data/db/OrderManage.db

# 6. Apache設定
sudo tee /etc/apache2/sites-available/sns.conf > /dev/null <<'EOF'
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html/sns

    <Directory /var/www/html/sns>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Protect DB directory
    <Directory /var/www/sns_data>
        Require all denied
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/sns_error.log
    CustomLog ${APACHE_LOG_DIR}/sns_access.log combined
</VirtualHost>
EOF

sudo a2ensite sns.conf
sudo a2dissite 000-default.conf 2>/dev/null || true
sudo systemctl restart apache2

# 7. PHP設定 - セッション・タイムゾーン
sudo sed -i 's|;date.timezone =|date.timezone = Asia/Tokyo|' /etc/php/*/apache2/php.ini 2>/dev/null || true

# 8. ファイル権限
sudo chown -R www-data:www-data /var/www/html/sns
sudo chmod -R 755 /var/www/html/sns

echo ""
echo "=== セットアップ完了 ==="
echo "ブラウザで http://$(hostname -I | awk '{print $1}')/sns/ にアクセスしてください"
echo ""
echo "DBパス: /var/www/sns_data/db/OrderManage.db"
echo ""
