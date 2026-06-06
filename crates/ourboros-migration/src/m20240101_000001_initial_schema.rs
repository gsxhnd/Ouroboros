use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Assets::Table)
                    .if_not_exists()
                    .col(string(Assets::Id).primary_key())
                    .col(string_uniq(Assets::FilePath))
                    .col(string(Assets::FileName))
                    .col(string(Assets::FileExt))
                    .col(big_integer(Assets::FileSize))
                    .col(string_null(Assets::FileHash))
                    .col(string(Assets::MimeType))
                    .col(string(Assets::AssetType))
                    .col(integer_null(Assets::Width))
                    .col(integer_null(Assets::Height))
                    .col(double_null(Assets::Duration))
                    .col(integer(Assets::Rating).default(0))
                    .col(string_null(Assets::ColorHex))
                    .col(string_null(Assets::ColorPalette))
                    .col(string_null(Assets::Notes))
                    .col(string_null(Assets::MetadataJson))
                    .col(integer(Assets::IsDeleted).default(0))
                    .col(string(Assets::CreatedAt))
                    .col(string(Assets::ModifiedAt))
                    .col(string(Assets::IndexedAt))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Folders::Table)
                    .if_not_exists()
                    .col(string(Folders::Id).primary_key())
                    .col(string(Folders::Name))
                    .col(string_null(Folders::ParentId))
                    .col(string_null(Folders::Color))
                    .col(string_null(Folders::Icon))
                    .col(integer(Folders::SortOrder).default(0))
                    .col(string(Folders::CreatedAt))
                    .to_owned(),
            )
            .await?;

        self.create_junction_tables(manager).await?;
        self.create_indexes(manager).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(AssetTags::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(AssetFolders::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(SmartFolders::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Tags::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Folders::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Assets::Table).to_owned()).await?;
        Ok(())
    }
}

impl Migration {
    async fn create_junction_tables(&self, manager: &SchemaManager<'_>) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AssetFolders::Table)
                    .if_not_exists()
                    .col(string(AssetFolders::AssetId))
                    .col(string(AssetFolders::FolderId))
                    .primary_key(
                        Index::create()
                            .col(AssetFolders::AssetId)
                            .col(AssetFolders::FolderId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(AssetFolders::Table, AssetFolders::AssetId)
                            .to(Assets::Table, Assets::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(AssetFolders::Table, AssetFolders::FolderId)
                            .to(Folders::Table, Folders::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Tags::Table)
                    .if_not_exists()
                    .col(string(Tags::Id).primary_key())
                    .col(string_uniq(Tags::Name))
                    .col(string_null(Tags::GroupName))
                    .col(string_null(Tags::Color))
                    .col(string(Tags::CreatedAt))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AssetTags::Table)
                    .if_not_exists()
                    .col(string(AssetTags::AssetId))
                    .col(string(AssetTags::TagId))
                    .primary_key(
                        Index::create()
                            .col(AssetTags::AssetId)
                            .col(AssetTags::TagId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(AssetTags::Table, AssetTags::AssetId)
                            .to(Assets::Table, Assets::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(AssetTags::Table, AssetTags::TagId)
                            .to(Tags::Table, Tags::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(SmartFolders::Table)
                    .if_not_exists()
                    .col(string(SmartFolders::Id).primary_key())
                    .col(string(SmartFolders::Name))
                    .col(string(SmartFolders::RulesJson))
                    .col(integer(SmartFolders::SortOrder).default(0))
                    .col(string(SmartFolders::CreatedAt))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn create_indexes(&self, manager: &SchemaManager<'_>) -> Result<(), DbErr> {
        manager
            .create_index(Index::create().name("idx_assets_type").table(Assets::Table).col(Assets::AssetType).to_owned())
            .await?;
        manager
            .create_index(Index::create().name("idx_assets_ext").table(Assets::Table).col(Assets::FileExt).to_owned())
            .await?;
        manager
            .create_index(Index::create().name("idx_assets_rating").table(Assets::Table).col(Assets::Rating).to_owned())
            .await?;
        manager
            .create_index(Index::create().name("idx_assets_color").table(Assets::Table).col(Assets::ColorHex).to_owned())
            .await?;
        manager
            .create_index(Index::create().name("idx_assets_created").table(Assets::Table).col(Assets::CreatedAt).to_owned())
            .await?;
        manager
            .create_index(Index::create().name("idx_assets_hash").table(Assets::Table).col(Assets::FileHash).to_owned())
            .await?;
        manager
            .create_index(Index::create().name("idx_tags_group").table(Tags::Table).col(Tags::GroupName).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Assets {
    Table,
    Id,
    FilePath,
    FileName,
    FileExt,
    FileSize,
    FileHash,
    MimeType,
    AssetType,
    Width,
    Height,
    Duration,
    Rating,
    ColorHex,
    ColorPalette,
    Notes,
    MetadataJson,
    IsDeleted,
    CreatedAt,
    ModifiedAt,
    IndexedAt,
}

#[derive(DeriveIden)]
enum Folders {
    Table,
    Id,
    Name,
    ParentId,
    Color,
    Icon,
    SortOrder,
    CreatedAt,
}

#[derive(DeriveIden)]
enum AssetFolders {
    Table,
    AssetId,
    FolderId,
}

#[derive(DeriveIden)]
enum Tags {
    Table,
    Id,
    Name,
    GroupName,
    Color,
    CreatedAt,
}

#[derive(DeriveIden)]
enum AssetTags {
    Table,
    AssetId,
    TagId,
}

#[derive(DeriveIden)]
enum SmartFolders {
    Table,
    Id,
    Name,
    RulesJson,
    SortOrder,
    CreatedAt,
}
