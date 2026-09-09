import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    if (payload.role !== 'Administrador') {
      response.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  } catch {
    response.status(401).json({ error: 'Unauthorized' });
  }
}