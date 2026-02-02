"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoaders = void 0;
const dataloader_1 = __importDefault(require("dataloader"));
// Batch function for loading playlists by creator IDs
const batchPlaylistsByCreator = async (db, creatorIds) => {
    const playlists = await db.playlists
        .find({ creator: { $in: [...creatorIds] } })
        .toArray();
    // Map results back to the order of input IDs
    const playlistsByCreator = new Map();
    for (const playlist of playlists) {
        const creatorId = playlist.creator;
        if (!playlistsByCreator.has(creatorId)) {
            playlistsByCreator.set(creatorId, []);
        }
        playlistsByCreator.get(creatorId).push(playlist);
    }
    return creatorIds.map((id) => playlistsByCreator.get(id) || []);
};
// Batch function for loading lessons by creator IDs
const batchLessonsByCreator = async (db, creatorIds) => {
    const lessons = await db.lessons
        .find({ creator: { $in: [...creatorIds] } })
        .toArray();
    const lessonsByCreator = new Map();
    for (const lesson of lessons) {
        const creatorId = lesson.creator;
        if (!lessonsByCreator.has(creatorId)) {
            lessonsByCreator.set(creatorId, []);
        }
        lessonsByCreator.get(creatorId).push(lesson);
    }
    return creatorIds.map((id) => lessonsByCreator.get(id) || []);
};
// Batch function for loading quizzes by creator IDs
const batchQuizzesByCreator = async (db, creatorIds) => {
    const quizzes = await db.quizzes
        .find({ creator: { $in: [...creatorIds] } })
        .toArray();
    const quizzesByCreator = new Map();
    for (const quiz of quizzes) {
        const creatorId = quiz.creator;
        if (!quizzesByCreator.has(creatorId)) {
            quizzesByCreator.set(creatorId, []);
        }
        quizzesByCreator.get(creatorId).push(quiz);
    }
    return creatorIds.map((id) => quizzesByCreator.get(id) || []);
};
// Batch function for loading articles by creator IDs
const batchArticlesByCreator = async (db, creatorIds) => {
    const articles = await db.articles
        .find({ creator: { $in: [...creatorIds] } })
        .toArray();
    const articlesByCreator = new Map();
    for (const article of articles) {
        const creatorId = article.creator;
        if (!articlesByCreator.has(creatorId)) {
            articlesByCreator.set(creatorId, []);
        }
        articlesByCreator.get(creatorId).push(article);
    }
    return creatorIds.map((id) => articlesByCreator.get(id) || []);
};
// Batch function for loading lessons by IDs (for bookmarks)
const batchLessonsById = async (db, lessonIds) => {
    // Query lessons - the _id field can be a string in this database
    const lessons = await db.lessons
        .find({ _id: { $in: lessonIds } })
        .toArray();
    const lessonsById = new Map();
    for (const lesson of lessons) {
        lessonsById.set(lesson._id.toString(), lesson);
    }
    return lessonIds.map((id) => lessonsById.get(id) || null);
};
const createLoaders = (db) => ({
    playlistsByCreator: new dataloader_1.default((keys) => batchPlaylistsByCreator(db, keys)),
    lessonsByCreator: new dataloader_1.default((keys) => batchLessonsByCreator(db, keys)),
    quizzesByCreator: new dataloader_1.default((keys) => batchQuizzesByCreator(db, keys)),
    articlesByCreator: new dataloader_1.default((keys) => batchArticlesByCreator(db, keys)),
    lessonsById: new dataloader_1.default((keys) => batchLessonsById(db, keys)),
});
exports.createLoaders = createLoaders;
