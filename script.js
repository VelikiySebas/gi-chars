const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { EnkaClient } = require("enka-network-api");

require('dotenv').config();

dayjs.extend(utc);
dayjs.extend(timezone);

// ----------------------
// Конфигурация
// ----------------------
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const REPO_NAME = process.env.REPO_NAME;
const BRANCH = process.env.BRANCH;

const enka = new EnkaClient();

if (!GITHUB_USER || !REPO_NAME || !BRANCH) {
  throw new Error('Одно из полей не найдено: GITHUB_USER, REPO_NAME, BRANCH');
}

const ELEMENT_MAP = {
  Electric: 14,
  Fire: 17,
  Grass: 13,
  Ice: 12,
  Rock: 15,
  Water: 16,
  Wind: 11,
};

const WEAPON_MAP = {
  WEAPON_SWORD_ONE_HAND: 5,
  WEAPON_CLAYMORE: 3,
  WEAPON_POLE: 4,
  WEAPON_CATALYST: 2,
  WEAPON_BOW: 1,
};

// Функция для загрузки одного файла в GitHub
async function uploadToGitHub(filePath, contentBuffer, commitMessage) {
  const fileName = path.basename(filePath);
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/${filePath}`;

  // Содержимое в base64
  const encodedContent = Buffer.from(contentBuffer).toString('base64');

  if (fs.existsSync(filePath)) {
    console.log(`Файл ${fileName} уже существует. Пропуск загрузки`)
    return;
  }

  try {
    const res = await axios.put(
      apiUrl,
      {
        message: commitMessage,
        content: encodedContent,
        branch: BRANCH,
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    console.log(`Файл ${fileName} успешно загружен. Ссылка: ${res.data.content.html_url}`);
  } catch (error) {
    console.error(`Ошибка загрузки ${fileName}:`, error.response?.data || error.message);
  }
}

// Функция для обновления json файла
async function updateFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

// async function updateEnemiesFile(filePath, data) {
//   const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
//   if (fileData?._id) data._id = fileData._id;
//   fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
// }
// console.log(profilepictures);

async function loadCharacter(id, character, isUploadToGitHub) {
  const lastIdNumbers = id.toString().slice(-3);
  const iconName = character.icon.name.split('_').pop().toLowerCase();

  // Формируем URL для загрузки изображений
  const iconUrl = character.icon.url; // `https://gensh.honeyhunterworld.com/img/${iconName}_${lastIdNumbers}_icon.webp`; <- Honeyhunter обрезает иконки
  const gachaCardUrl = `https://gensh.honeyhunterworld.com/img/${iconName}_${lastIdNumbers}_gacha_card.webp`;
  const gachaSplashUrl = `https://gensh.honeyhunterworld.com/img/${iconName}_${lastIdNumbers}_gacha_splash.webp`;

  let iconUrlBuffer = '';
  let gachaCardUrlBuffer = '';
  let gachaSplashUrlBuffer = '';

  // Получение icon
  try {
    const iconResponse = await axios.get(iconUrl, { responseType: 'arraybuffer' });
    iconUrlBuffer = iconResponse.data;
  } catch (error) {
    console.error(`Ошибка при загрузке iconUrl для персонажа ${character._nameId}:`, error);
  }

  // Получение gacha card
  try {
    const gachaCardResponse = await axios.get(gachaCardUrl, { responseType: 'arraybuffer' });
    gachaCardUrlBuffer = gachaCardResponse.data;
  } catch (error) {
    console.error(`Ошибка при загрузке gachaCardUrl для персонажа ${character._nameId}:`, error);
  }

  // Получение gacha splash
  try {
    const gachaSplashResponse = await axios.get(gachaSplashUrl, { responseType: 'arraybuffer' });
    gachaSplashUrlBuffer = gachaSplashResponse.data;
  } catch (error) {
    console.error(`Ошибка при загрузке gachaSplashUrl для персонажа ${character._nameId}:`, error);
  }

  // Если хоть одно из изображений не получено, пропускаем персонажа
  if (!iconUrlBuffer || !gachaCardUrlBuffer || !gachaSplashUrlBuffer) {
    console.warn(`Пропускаем персонажа ${character._nameId} из-за ошибки загрузки изображений.`);
    return;
  }

  // Пути для загрузки
  const iconFilePath = `images/characters/icons/${id}.png`;
  const gachaCardFilePath = `images/characters/gacha-card/${id}.webp`;
  const gachaSplashFilePath = `images/characters/gacha-splash/${id}.webp`;

  // Загружаем в GitHub оригинальные изображения
  if (isUploadToGitHub) {
    try {
      await uploadToGitHub(iconFilePath, iconUrlBuffer, `Upload icon for ${character._nameId}`);
      await uploadToGitHub(gachaCardFilePath, gachaCardUrlBuffer, `Upload half portrait for ${character._nameId}`);
      await uploadToGitHub(gachaSplashFilePath, gachaSplashUrlBuffer, `Upload hoyo icon portrait for ${character._nameId}`);
    } catch (error) {
      console.error(`Ошибка при загрузке файлов на GitHub для персонажа ${character._nameId}:`, error);
      return;
    }
  }

  // Формируем ссылки для JSON
  const iconGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${iconFilePath}`;
  const gachaCardGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${gachaCardFilePath}`;
  const gachaSplashGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${gachaSplashFilePath}`;

  return {
    id,
    code: character._nameId,
    rank: character.stars,
    type: WEAPON_MAP[character.weaponType],
    element: ELEMENT_MAP[character.element.id],
    en: character.name.get('en'),
    ru: character.name.get('ru'),
    icon: iconGitHubUrl,
    gachaCard: gachaCardGitHubUrl,
    gachaSplash: gachaSplashGitHubUrl, // добавляем ссылку на уменьшенную версию
  };
}

async function processCharacters(isUploadToGitHub = true, isUpdateFile = true) {
  try {
    console.log('Начинаем обработку персонажей');
    const data = enka.getAllCharacters();

    const excludedIds = [];
    const results = [];

    for (const character of data) {
      const id = character.id;
      if (!id || !character.element?.id || excludedIds.includes(id)) continue;

      results.push(loadCharacter(id, character, isUploadToGitHub));
    }

    if (isUpdateFile) {
      updateFile('characters.json', (await Promise.all(results)).filter(Boolean));
    }
    console.log('Персонажи обработаны и сохранены в characters.json');
  } catch (error) {
    console.error('Ошибка при обработке персонажей:', error);
  }
}

const filteredWeaponIds = [11419, 11420, 11421, 11429, 12304, 13304, 14306, 15306];

async function loadWeapon(id, weapon, isUploadToGitHub) {
  // Формируем URL для загрузки
  const weaponWebpUrl = `https://api.hakush.in/gi/UI/${weapon.awakenIcon.name}.webp`;

  // Скачиваем webp
  const weaponWebpBuffer = (await axios.get(weaponWebpUrl, { responseType: 'arraybuffer' })).data;

  // Конвертируем webp → png
  const weaponPngBuffer = await sharp(weaponWebpBuffer).png().toBuffer();

  // Пути для загрузки
  const weaponFilePath = `images/weapons/${weapon.awakenIcon.name}.png`;

  // Загружаем в GitHub
  if (isUploadToGitHub) {
    await uploadToGitHub(weaponFilePath, weaponPngBuffer, `Upload weapon icon for ${weapon._nameId}`);
  }

  // Формируем ссылку для JSON
  const weaponGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${weaponFilePath}`;

  return {
    id,
    rank: weapon.stars,
    type: WEAPON_MAP[weapon.weaponType],
    en: weapon.name.get('en'),
    ru: weapon.name.get('ru'),
    icon: weaponGitHubUrl,
  };
}

// Функция обработки оружия
async function processWeapons(isUploadToGitHub = true, isUpdateFile = true) {
  try {
    console.log('Начинаем обработку оружия');
    const data = enka.getAllWeapons();

    const results = [];

    for (const weapon of data) {
      const id = weapon.id;
      if (!id || weapon.stars <= 3 || filteredWeaponIds.includes(id)) continue;

      results.push(loadWeapon(id, weapon, isUploadToGitHub));
    }

    if (isUpdateFile) {
      updateFile('weapons.json', await Promise.all(results));
    }
    console.log('Оружие обработано и сохранено в weapons.json');
  } catch (error) {
    console.error('Ошибка при обработке оружия:', error);
  }
}

async function processAvatars(isUploadToGitHub = true, isUpdateFile = true) {
  const gitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}`;
  const dirPath = 'images/avatars';

  const results = [];
  for (const { iconPath } of Object.values(enka.cachedAssetsManager.getExcelData("ProfilePictureExcelConfigData"))) {
    const path = `${dirPath}/${iconPath}.png`;
    const avatarGitHubUrl = `${gitHubUrl}/${path}`;
    try {
      const avatarWebpUrl = `https://enka.network/ui/${iconPath}.png`;
      const buffer = (await axios.get(avatarWebpUrl, { responseType: 'arraybuffer' })).data;
      if (isUploadToGitHub) {
        await uploadToGitHub(path, buffer, `Upload avatar with filename: ${iconPath}`);
      }
      results.push({ avatarSrc: avatarGitHubUrl, createdAt: new Date() });
    } catch (error) {
      console.error(`Ошибка при загрузке файлов на GitHub аватара ${iconPath}:`, error);
      continue;
    }
  }

  const resultFilePath = 'avatars.json';
  if (isUpdateFile) {
    const file = JSON.parse(fs.readFileSync(resultFilePath, 'utf8'));
    fs.writeFileSync(resultFilePath, JSON.stringify(results.map((result) => {
      const existingAvatar = file.find(({ avatarSrc }) => result.avatarSrc === avatarSrc);
      return existingAvatar ?? result;
    })), 'utf8');
  }
}

// Основная функция
async function fetchAndProcessData(isUploadToGitHub = true, isUpdateFiles = true) {
  // await processCharacters(isUploadToGitHub, isUpdateFiles);
  // await processWeapons(isUploadToGitHub, isUpdateFiles);
  // await processAvatars(isUploadToGitHub, isUpdateFiles);
}

// Запуск
fetchAndProcessData();
