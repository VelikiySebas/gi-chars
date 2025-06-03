const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
  throw new Error('Ссылка на базу данных не найдена');
}
const agentsJsonPath = './characters.json';
const enginesJsonPath = './weapons.json';

// File operations
const readFile = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const writeFile = (path, data) => fs.writeFileSync(path, JSON.stringify(data), 'utf8');

// Serializers
const serializeAgents = (data) => {
  return data.map((agent) => ({
    _id: new mongoose.Types.ObjectId(agent._id),
    enkaId: agent.id,
    name: {
      en: agent.en,
      ru: agent.ru,
    },
    rarity: agent.rank,
    specialty: agent.type,
    attribute: agent.element,
    iconSrc: agent.icon,
    gachaCard: agent.gachaCard,
    gachaSplash: agent.gachaSplash,
  }));
};
const serializeEngines = (data) => {
  return data.map((engine) => ({
    _id: new mongoose.Types.ObjectId(engine._id),
    enkaId: engine.id,
    title: {
      en: engine.en,
      ru: engine.ru,
    },
    rarity: engine.rank,
    specialty: engine.type,
    iconSrc: engine.icon,
  }));
};

// Db refresh function
const refreshCollection = async (coll, data, originalFile) => {
  console.log(`Start refresh collection ${coll}. Data length: ${data.length}`);
  const collection = mongoose.connection.db.collection(coll);
  for (const [index, dataItem] of data.entries()) {
    const refreshItem = { ...dataItem };
    delete refreshItem._id;
    let item = await collection.findOneAndUpdate({ enkaId: dataItem.enkaId }, { $set: refreshItem }, { upsert: true, new: true });
    if (!item) {
      item = await collection.findOne({ enkaId: dataItem.enkaId });
    }
    if (!dataItem._id || dataItem._id !== item._id) {
      originalFile[index]._id = item._id;
    }
  }
  return data;
};

mongoose.connect(dbUrl).then(async () => {
  console.log('[START]: Db refresh');

  // Characters
  const agentsFileData = readFile(agentsJsonPath);
  const agents = serializeAgents(agentsFileData);
  await refreshCollection('agents', agents, agentsFileData);
  writeFile(agentsJsonPath, agentsFileData);

  // Weapons
  const enginesFileData = readFile(enginesJsonPath);
  const engines = serializeEngines(enginesFileData);
  await refreshCollection('engines', engines, enginesFileData);
  writeFile(enginesJsonPath, enginesFileData);

  console.log('[DONE]: Db refresh');
  mongoose.connection.close();
});
