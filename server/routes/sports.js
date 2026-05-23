const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all sports (public)
router.get('/', async (req, res) => {
  try {
    const filter = req.query.active !== 'false' ? { isActive: true } : {};
    const sports = await prisma.sport.findMany({
      where: filter,
      orderBy: { displayName: 'asc' },
      include: { formats: true }
    });
    res.json(sports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single sport by id or name
router.get('/:idOrName', async (req, res) => {
  try {
    const { idOrName } = req.params;
    const isId = !isNaN(parseInt(idOrName, 10));
    const sport = isId
      ? await prisma.sport.findUnique({
          where: { id: parseInt(idOrName, 10) },
          include: { formats: true }
        })
      : await prisma.sport.findFirst({
          where: { name: idOrName.toLowerCase(), isActive: true },
          include: { formats: true }
        });
    if (!sport) {
      return res.status(404).json({ message: 'Sport not found' });
    }
    res.json(sport);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create sport (admin)
router.post('/', auth, [
  body('name').trim().notEmpty().withMessage('Name (slug) is required'),
  body('displayName').trim().notEmpty().withMessage('Display name is required'),
  body('formats').isArray().withMessage('formats must be an array')
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, displayName, formats } = req.body;
    const slug = name.toLowerCase().trim();
    const existing = await prisma.sport.findFirst({ where: { name: slug } });
    if (existing) {
      return res.status(400).json({ message: 'Sport with this name already exists' });
    }
    const sport = await prisma.sport.create({
      data: {
        name: slug,
        displayName: displayName.trim(),
        formats: {
          create: formats.map(f => ({
            name: f.name,
            playersPerTeam: f.playersPerTeam,
            minTeams: f.minTeams ?? 2,
            maxTeams: f.maxTeams ?? 2,
            description: f.description,
            config: f.config
          }))
        }
      },
      include: { formats: true }
    });
    res.status(201).json(sport);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update sport (admin)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const sportId = parseInt(req.params.id, 10);
    const sport = await prisma.sport.findUnique({
      where: { id: sportId },
      include: { formats: true }
    });
    if (!sport) {
      return res.status(404).json({ message: 'Sport not found' });
    }
    const { displayName, formats, isActive } = req.body;
    const updateData = {};
    if (displayName != null) updateData.displayName = displayName;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    if (formats != null && Array.isArray(formats)) {
      await prisma.sportFormat.deleteMany({ where: { sportId } });
      if (formats.length > 0) {
        await prisma.sportFormat.createMany({
          data: formats.map(f => ({
            sportId,
            name: f.name,
            playersPerTeam: f.playersPerTeam,
            minTeams: f.minTeams ?? 2,
            maxTeams: f.maxTeams ?? 2,
            description: f.description,
            config: f.config
          }))
        });
      }
    }

    const updated = await prisma.sport.update({
      where: { id: sportId },
      data: updateData,
      include: { formats: true }
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
