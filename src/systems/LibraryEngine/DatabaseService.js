const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.workspacePath = null;
    this.userDataPath = null;
  }

  /**
   * Generate a hash for workspace identification
   * @param {string} mainDirectory - The main directory path
   * @returns {string} - Hash of the directory path
   */
  generateWorkspaceHash(mainDirectory) {
    return crypto.createHash('sha256').update(mainDirectory).digest('hex').substring(0, 16);
  }

  /**
   * Get workspace directory path for a given main directory
   * @param {string} mainDirectory - The main directory path
   * @returns {string} - Workspace directory path
   */
  getWorkspacePath(mainDirectory) {
    const workspaceHash = this.generateWorkspaceHash(mainDirectory);
    return path.join(this.userDataPath, 'workspaces', workspaceHash);
  }

  /**
   * Initialize database connection and create tables if they don't exist
   * @param {string} mainDirectory - The main directory path for this workspace
   * @param {string} userDataPath - The user data path
   */
  async initialize(mainDirectory, userDataPath) {
    // Close existing connection if any
    if (this.db) {
      await this.close();
    }

    this.userDataPath = userDataPath;
    this.workspacePath = this.getWorkspacePath(mainDirectory);
    this.dbPath = path.join(this.workspacePath, 'library.db');

    // Ensure workspace directory exists
    try {
      await fs.access(this.workspacePath);
    } catch {
      await fs.mkdir(this.workspacePath, { recursive: true });
      console.log('Created workspace directory:', this.workspacePath);
    }

    // Also create cache directory
    const cachePath = path.join(this.workspacePath, 'cache');
    try {
      await fs.access(cachePath);
    } catch {
      await fs.mkdir(cachePath, { recursive: true });
      console.log('Created cache directory:', cachePath);
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create tables
        this.db.serialize(() => {
          // media_entry table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS media_entry (
              ID TEXT PRIMARY KEY,
              PATH TEXT NOT NULL,
              NAME TEXT NOT NULL,
              TYPE TEXT NOT NULL,
              RATING INTEGER DEFAULT 0,
              DATE_ADDED INTEGER NOT NULL,
              DATE_LAST_OPENED INTEGER,
              PROGRESS REAL DEFAULT 0.0,
              PAGE_COUNT INTEGER DEFAULT 0,
              THUMBNAIL_PROCESSED BOOLEAN DEFAULT FALSE,
              CURRENTLY_READING BOOLEAN DEFAULT FALSE,
              CUSTOM_THUMBNAIL_PATH TEXT,
              IN_COLLECTION INTEGER DEFAULT 0
            )
          `);

          // collections table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS collections (
              ID TEXT PRIMARY KEY,
              PATH TEXT,
              NAME TEXT NOT NULL,
              AUTO_GENERATED BOOLEAN DEFAULT FALSE,
              RATING INTEGER DEFAULT 0,
              LAST_OPENED_ID TEXT,
              THUMBNAIL_ID TEXT
            )
          `);

          // collection_members table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS collection_members (
              COLLECTION_ID TEXT NOT NULL,
              MEDIA_ENTRY_ID TEXT NOT NULL,
              SORT_ORDER INTEGER DEFAULT 0,
              PRIMARY KEY (COLLECTION_ID, MEDIA_ENTRY_ID),
              FOREIGN KEY (COLLECTION_ID) REFERENCES collections(ID) ON DELETE CASCADE,
              FOREIGN KEY (MEDIA_ENTRY_ID) REFERENCES media_entry(ID) ON DELETE CASCADE
            )
          `);

          // tags table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS tags (
              ID INTEGER PRIMARY KEY AUTOINCREMENT,
              NAME TEXT UNIQUE NOT NULL
            )
          `);

          // media_tags table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS media_tags (
              MEDIA_ENTRY_ID TEXT NOT NULL,
              TAG_ID INTEGER NOT NULL,
              PRIMARY KEY (MEDIA_ENTRY_ID, TAG_ID),
              FOREIGN KEY (MEDIA_ENTRY_ID) REFERENCES media_entry(ID) ON DELETE CASCADE,
              FOREIGN KEY (TAG_ID) REFERENCES tags(ID) ON DELETE CASCADE
            )
          `);

          // collection_tags table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS collection_tags (
              COLLECTION_ID TEXT NOT NULL,
              TAG_ID INTEGER NOT NULL,
              PRIMARY KEY (COLLECTION_ID, TAG_ID),
              FOREIGN KEY (COLLECTION_ID) REFERENCES collections(ID) ON DELETE CASCADE,
              FOREIGN KEY (TAG_ID) REFERENCES tags(ID) ON DELETE CASCADE
            )
          `);

          // Create indexes for better performance
          this.db.run('CREATE INDEX IF NOT EXISTS idx_media_entry_path ON media_entry(PATH)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_media_entry_type ON media_entry(TYPE)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_media_entry_in_collection ON media_entry(IN_COLLECTION)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_collections_path ON collections(PATH)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_collections_rating ON collections(RATING)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_collection_members_collection ON collection_members(COLLECTION_ID)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_collection_members_media ON collection_members(MEDIA_ENTRY_ID)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(NAME)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_media_tags_media ON media_tags(MEDIA_ENTRY_ID)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(TAG_ID)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_collection_tags_collection ON collection_tags(COLLECTION_ID)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_collection_tags_tag ON collection_tags(TAG_ID)');

          // Add new columns to existing tables if they don't exist
          this.db.run(`ALTER TABLE collections ADD COLUMN THUMBNAIL_ID TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Could not add THUMBNAIL_ID column (may already exist):', err.message);
            }
          });
          
          this.db.run(`ALTER TABLE collections ADD COLUMN RATING INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Could not add RATING column to collections (may already exist):', err.message);
            }
          });
          
          this.db.run(`ALTER TABLE media_entry ADD COLUMN DATE_LAST_OPENED INTEGER`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Could not add DATE_LAST_OPENED column (may already exist):', err.message);
            }
          });
          
          this.db.run(`ALTER TABLE media_entry ADD COLUMN CURRENTLY_READING BOOLEAN DEFAULT FALSE`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Could not add CURRENTLY_READING column (may already exist):', err.message);
            }
          });
          
          this.db.run(`ALTER TABLE media_entry ADD COLUMN CUSTOM_THUMBNAIL_PATH TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Could not add CUSTOM_THUMBNAIL_PATH column (may already exist):', err.message);
            }
          });
          
          this.db.run(`ALTER TABLE media_entry ADD COLUMN IN_COLLECTION INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Could not add IN_COLLECTION column (may already exist):', err.message);
            }
          });

          this.db.run(`ALTER TABLE collection_members ADD COLUMN IS_COMPLETED INTEGER NOT NULL DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Could not add IS_COMPLETED column to collection_members (may already exist):', err.message);
            }
          });
        });

        resolve();
      });
    });
  }

  /**
   * Upsert a media entry (insert or update)
   */
  async upsertMediaEntry(entry) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO media_entry 
        (ID, PATH, NAME, TYPE, RATING, DATE_ADDED, PROGRESS, PAGE_COUNT, THUMBNAIL_PROCESSED, IN_COLLECTION)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        entry.id,
        entry.path,
        entry.name,
        entry.type,
        entry.rating || 0,
        entry.dateAdded || Date.now(),
        entry.progress || 0.0,
        entry.pageCount || 0,
        entry.thumbnailProcessed || false,
        entry.inCollection || 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: entry.id, changes: this.changes });
        }
      });

      stmt.finalize();
    });
  }

  /**
   * Upsert a collection
   */
  async upsertCollection(collection) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO collections 
        (ID, PATH, NAME, AUTO_GENERATED, LAST_OPENED_ID, THUMBNAIL_ID, RATING)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        collection.id,
        collection.path,
        collection.name,
        collection.autoGenerated || false,
        collection.lastOpenedId || null,
        collection.thumbnailId || null,
        collection.rating || 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: collection.id, changes: this.changes });
        }
      });

      stmt.finalize();
    });
  }

  /**
   * Add media entry to collection
   */
  async addCollectionMember(collectionId, mediaEntryId, sortOrder = 0) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO collection_members 
        (COLLECTION_ID, MEDIA_ENTRY_ID, SORT_ORDER)
        VALUES (?, ?, ?)
      `);

      stmt.run([collectionId, mediaEntryId, sortOrder], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ collectionId, mediaEntryId, changes: this.changes });
        }
      });

      stmt.finalize();
    });
  }

  /**
   * Get media entry by ID
   */
  async getMediaEntry(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM media_entry WHERE ID = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get collection by ID
   */
  async getCollection(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM collections WHERE ID = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all media entries in a collection
   */
  async getCollectionMembers(collectionId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT me.*, cm.SORT_ORDER, cm.IS_COMPLETED
        FROM media_entry me
        JOIN collection_members cm ON me.ID = cm.MEDIA_ENTRY_ID
        WHERE cm.COLLECTION_ID = ?
        ORDER BY cm.SORT_ORDER
      `, [collectionId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get all collection memberships for a specific entry
   */
  async getCollectionMembersForEntry(entryId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT cm.*, c.NAME as collection_name 
        FROM collection_members cm
        JOIN collections c ON cm.COLLECTION_ID = c.ID
        WHERE cm.MEDIA_ENTRY_ID = ?
        ORDER BY cm.SORT_ORDER
      `, [entryId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Remove a media entry from a collection
   */
  async removeCollectionMember(collectionId, mediaEntryId) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        DELETE FROM collection_members 
        WHERE COLLECTION_ID = ? AND MEDIA_ENTRY_ID = ?
      `);

      stmt.run([collectionId, mediaEntryId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ collectionId, mediaEntryId, changes: this.changes });
        }
      });

      stmt.finalize();
    });
  }

  /**
   * Update IN_COLLECTION status for a media entry
   */
  async updateMediaEntryCollectionStatus(entryId, inCollection) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('UPDATE media_entry SET IN_COLLECTION = ? WHERE ID = ?');
      stmt.run([inCollection ? 1 : 0, entryId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ entryId, inCollection, changes: this.changes });
        }
      });
      stmt.finalize();
    });
  }

  /**
   * Get all user-created collections (AUTO_GENERATED = FALSE)
   */
  async getUserCollections() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM collections WHERE AUTO_GENERATED = FALSE ORDER BY NAME', async (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const collectionsWithTags = await Promise.all(
            rows.map(async (row) => {
              const tags = await this.getCollectionTags(row.ID);
              return {
                ...row,
                tags: tags
              };
            })
          );
          resolve(collectionsWithTags);
        }
      });
    });
  }

  /**
   * Delete a collection by ID (explicitly removes members and tags for compatibility)
   */
  async deleteCollection(collectionId) {
    return new Promise((resolve, reject) => {
      // First remove all collection members
      this.db.run('DELETE FROM collection_members WHERE COLLECTION_ID = ?', [collectionId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Then remove all collection tags
        this.db.run('DELETE FROM collection_tags WHERE COLLECTION_ID = ?', [collectionId], (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Finally delete the collection
          const stmt = this.db.prepare('DELETE FROM collections WHERE ID = ?');
          stmt.run([collectionId], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ collectionId, changes: this.changes });
            }
          });
          stmt.finalize();
        });
      });
    });
  }

  /**
   * Get all media entries
   */
  async getAllMediaEntries() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM media_entry ORDER BY DATE_ADDED DESC', async (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Add tags to each entry
          const entriesWithTags = await Promise.all(
            rows.map(async (row) => {
              const tags = await this.getEntryTags(row.ID);
              return {
                ...row,
                tags: tags
              };
            })
          );
          resolve(entriesWithTags);
        }
      });
    });
  }

  /**
   * Get all collections
   */
  async getAllCollections() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM collections ORDER BY NAME', async (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Add tags to each collection
          const collectionsWithTags = await Promise.all(
            rows.map(async (row) => {
              const tags = await this.getCollectionTags(row.ID);
              return {
                ...row,
                tags: tags
              };
            })
          );
          resolve(collectionsWithTags);
        }
      });
    });
  }

  /**
   * Get all collections with their members
   */
  async getCollectionsWithMembers() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM collections ORDER BY NAME', async (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Add tags and members to each collection
          const collectionsWithDetails = await Promise.all(
            rows.map(async (row) => {
              const tags = await this.getCollectionTags(row.ID);
              const members = await this.getCollectionMembers(row.ID);
              return {
                ...row,
                tags: tags,
                members: members
              };
            })
          );
          resolve(collectionsWithDetails);
        }
      });
    });
  }

  /**
   * Add a tag to the database
   * @param {string} tagName - Name of the tag to add
   * @returns {Promise<{id: number, name: string}>} - Created tag object with ID
   */
  async addTag(tagName) {
    return new Promise((resolve, reject) => {
      const db = this.db; // Capture db reference to maintain context
      const stmt = db.prepare('INSERT OR IGNORE INTO tags (NAME) VALUES (?)');
      stmt.run([tagName], function(err) {
        if (err) {
          reject(err);
        } else {
          // Get the tag ID (either newly inserted or existing)
          const getStmt = db.prepare('SELECT ID, NAME FROM tags WHERE NAME = ?');
          getStmt.get([tagName], (err, row) => {
            if (err) {
              reject(err);
            } else if (!row) {
              reject(new Error('Failed to retrieve tag after insert'));
            } else {
              resolve({ id: row.ID, name: row.NAME });
            }
          });
          getStmt.finalize();
        }
      });
      stmt.finalize();
    });
  }

  async renameTag(oldName, newName) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('UPDATE tags SET NAME = ? WHERE NAME = ?');
      stmt.run([newName, oldName], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, updatedCount: this.changes });
        }
      });
      stmt.finalize();
    });
  }

  /**
   * Remove a tag from the database (cascades to remove all associations)
   * @param {string} tagName - Name of the tag to remove
   * @returns {Promise<{success: boolean, deletedCount: number}>}
   */
  async removeTag(tagName) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('DELETE FROM tags WHERE NAME = ?');
      stmt.run([tagName], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, deletedCount: this.changes });
        }
      });
      stmt.finalize();
    });
  }

  /**
   * Get all tags from the database
   * @returns {Promise<string[]>} - Array of tag names
   */
  async getAllTags() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT NAME FROM tags ORDER BY NAME', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => row.NAME));
        }
      });
    });
  }

  /**
   * Add a tag to a media entry
   * @param {string} entryId - Media entry ID
   * @param {string} tagName - Tag name
   * @returns {Promise<void>}
   */
  async addTagToEntry(entryId, tagName) {
    return new Promise(async (resolve, reject) => {
      try {
        // First ensure the tag exists
        const tag = await this.addTag(tagName);
        
        // Then associate it with the entry
        const stmt = this.db.prepare('INSERT OR IGNORE INTO media_tags (MEDIA_ENTRY_ID, TAG_ID) VALUES (?, ?)');
        stmt.run([entryId, tag.id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        stmt.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Remove a tag from a media entry
   * @param {string} entryId - Media entry ID
   * @param {string} tagName - Tag name
   * @returns {Promise<void>}
   */
  async removeTagFromEntry(entryId, tagName) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        DELETE FROM media_tags 
        WHERE MEDIA_ENTRY_ID = ? 
        AND TAG_ID = (SELECT ID FROM tags WHERE NAME = ?)
      `);
      stmt.run([entryId, tagName], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      stmt.finalize();
    });
  }

  /**
   * Get all tags for a media entry
   * @param {string} entryId - Media entry ID
   * @returns {Promise<string[]>} - Array of tag names
   */
  async getEntryTags(entryId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT t.NAME 
        FROM tags t
        JOIN media_tags mt ON t.ID = mt.TAG_ID
        WHERE mt.MEDIA_ENTRY_ID = ?
        ORDER BY t.NAME
      `, [entryId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => row.NAME));
        }
      });
    });
  }

  /**
   * Add a tag to a collection
   * @param {string} collectionId - Collection ID
   * @param {string} tagName - Tag name
   * @returns {Promise<void>}
   */
  async addTagToCollection(collectionId, tagName) {
    return new Promise(async (resolve, reject) => {
      try {
        // First ensure the tag exists
        const tag = await this.addTag(tagName);
        
        // Then associate it with the collection
        const stmt = this.db.prepare('INSERT OR IGNORE INTO collection_tags (COLLECTION_ID, TAG_ID) VALUES (?, ?)');
        stmt.run([collectionId, tag.id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        stmt.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Remove a tag from a collection
   * @param {string} collectionId - Collection ID
   * @param {string} tagName - Tag name
   * @returns {Promise<void>}
   */
  async removeTagFromCollection(collectionId, tagName) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        DELETE FROM collection_tags 
        WHERE COLLECTION_ID = ? 
        AND TAG_ID = (SELECT ID FROM tags WHERE NAME = ?)
      `);
      stmt.run([collectionId, tagName], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      stmt.finalize();
    });
  }

  /**
   * Get all tags for a collection
   * @param {string} collectionId - Collection ID
   * @returns {Promise<string[]>} - Array of tag names
   */
  async getCollectionTags(collectionId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT t.NAME 
        FROM tags t
        JOIN collection_tags ct ON t.ID = ct.TAG_ID
        WHERE ct.COLLECTION_ID = ?
        ORDER BY t.NAME
      `, [collectionId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => row.NAME));
        }
      });
    });
  }

  /**
   * Update collection thumbnail
   * @param {string} collectionId - Collection ID
   * @param {string} thumbnailId - Media entry ID to use as thumbnail
   */
  async setCollectionThumbnail(collectionId, thumbnailId) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE collections 
        SET THUMBNAIL_ID = ?
        WHERE ID = ?
      `, [thumbnailId, collectionId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  /**
   * Update collection member sort order
   * @param {string} collectionId - Collection ID
   * @param {string} mediaEntryId - Media entry ID
   * @param {number} sortOrder - New sort order
   */
  async updateCollectionMemberSortOrder(collectionId, mediaEntryId, sortOrder) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE collection_members 
        SET SORT_ORDER = ?
        WHERE COLLECTION_ID = ? AND MEDIA_ENTRY_ID = ?
      `, [sortOrder, collectionId, mediaEntryId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  /**
   * Update collection's last opened entry
   * @param {string} collectionId - Collection ID
   * @param {string} lastOpenedId - Last opened entry ID
   */
  async updateCollectionLastOpened(collectionId, lastOpenedId) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE collections 
        SET LAST_OPENED_ID = ?
        WHERE ID = ?
      `, [lastOpenedId, collectionId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  /**
   * Get cache path for this workspace
   * @returns {string} - Cache directory path
   */
  getCachePath() {
    if (!this.workspacePath) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return path.join(this.workspacePath, 'cache');
  }

  /**
   * Set rating for a media entry
   * @param {string} entryId - Media entry ID
   * @param {number} rating - Rating value (0-100)
   * @returns {Promise<void>}
   */
  async setEntryRating(entryId, rating) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('UPDATE media_entry SET RATING = ? WHERE ID = ?');
      stmt.run([rating, entryId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      stmt.finalize();
    });
  }

  /**
   * Set rating for a collection
   * @param {string} collectionId - Collection ID
   * @param {number} rating - Rating value (0-100)
   * @returns {Promise<void>}
   */
  async setCollectionRating(collectionId, rating) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('UPDATE collections SET RATING = ? WHERE ID = ?');
      stmt.run([rating, collectionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      stmt.finalize();
    });
  }
  async markCollectionMemberCompleted(collectionId, mediaEntryId) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE collection_members 
        SET IS_COMPLETED = 1 
        WHERE COLLECTION_ID = ? AND MEDIA_ENTRY_ID = ?
      `);

      stmt.run([collectionId, mediaEntryId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ collectionId, mediaEntryId, changes: this.changes });
        }
      });

      stmt.finalize();
    });
  }
  async markCollectionMemberNotCompleted(collectionId, mediaEntryId) {
  return new Promise((resolve, reject) => {
    const stmt = this.db.prepare(`
      UPDATE collection_members
      SET IS_COMPLETED = 0
      WHERE COLLECTION_ID = ? AND MEDIA_ENTRY_ID = ?
    `);
 
    stmt.run([collectionId, mediaEntryId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ collectionId, mediaEntryId, changes: this.changes });
      }
    });
 
    stmt.finalize();
  });
}
 
/**
 * Reset all collection members in a collection to IS_COMPLETED = 0
 */
async resetAllCollectionMembersCompleted(collectionId) {
  return new Promise((resolve, reject) => {
    const stmt = this.db.prepare(`
      UPDATE collection_members
      SET IS_COMPLETED = 0
      WHERE COLLECTION_ID = ?
    `);
 
    stmt.run([collectionId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ collectionId, changes: this.changes });
      }
    });
 
    stmt.finalize();
  });
}

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = DatabaseService;