import { Router } from 'express';
import { alertController } from '../controllers/alertController.js';

const router = Router();

router.get('/', alertController.list);
router.post('/:id/ack', alertController.acknowledge);
router.post('/:id/resolve', alertController.resolve);

export default router;
