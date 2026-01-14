import lf from "lovefield";

export let highlightsDB: lf.Database;
export let highlights: lf.schema.Table;

const hdbSchema = lf.schema.create("highlightsDB", 1);

hdbSchema
    .createTable("highlights")
    .addColumn("_id", lf.Type.INTEGER)
    .addPrimaryKey(["_id"], true)
    .addColumn("itemId", lf.Type.INTEGER)
    .addColumn("text", lf.Type.STRING)
    .addColumn("note", lf.Type.STRING)
    .addColumn("range", lf.Type.STRING)
    .addColumn("createdDate", lf.Type.DATE_TIME)
    .addIndex("idxItemId", ["itemId"], false);

export async function initHighlightsDB() {
    highlightsDB = await hdbSchema.connect();
    highlights = highlightsDB.getSchema().table("highlights");
}
