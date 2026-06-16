package com.sns.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteDataSource;

import javax.sql.DataSource;

// config.php の getDB() / PRAGMA 設定 相当
@Configuration
public class DatabaseConfig {

    @Value("${sns.db.path}")
    private String dbPath;

    @Bean
    public DataSource dataSource() {
        SQLiteConfig cfg = new SQLiteConfig();
        cfg.setJournalMode(SQLiteConfig.JournalMode.WAL);   // PRAGMA journal_mode=WAL
        cfg.enforceForeignKeys(true);                        // PRAGMA foreign_keys=ON

        SQLiteDataSource ds = new SQLiteDataSource(cfg);
        ds.setUrl("jdbc:sqlite:" + dbPath);
        return ds;
    }
}
