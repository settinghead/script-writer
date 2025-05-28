import { Request, Response, NextFunction } from 'express';

export const validateIdeationCreate = (req: Request, res: Response, next: NextFunction): void => {
    const { initialIdeas } = req.body;

    if (!initialIdeas || !Array.isArray(initialIdeas) || initialIdeas.length === 0) {
        res.status(400).json({
            error: "Missing or empty 'initialIdeas' in request body",
            details: "initialIdeas must be a non-empty array of strings"
        });
        return;
    }

    // Validate each idea is a non-empty string
    for (let i = 0; i < initialIdeas.length; i++) {
        if (typeof initialIdeas[i] !== 'string' || !initialIdeas[i].trim()) {
            res.status(400).json({
                error: `Invalid idea at index ${i}`,
                details: "Each idea must be a non-empty string"
            });
            return;
        }
    }

    next();
};

export const validatePlotGeneration = (req: Request, res: Response, next: NextFunction): void => {
    const { userInput, ideationTemplate } = req.body;

    if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
        res.status(400).json({
            error: "Missing or invalid 'userInput' in request body",
            details: "userInput must be a non-empty string"
        });
        return;
    }

    if (!ideationTemplate || typeof ideationTemplate !== 'string' || !ideationTemplate.trim()) {
        res.status(400).json({
            error: "Missing or invalid 'ideationTemplate' in request body",
            details: "ideationTemplate must be a non-empty string"
        });
        return;
    }

    next();
};

export const validateScriptCreate = (req: Request, res: Response, next: NextFunction): void => {
    const { name } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
        res.status(400).json({
            error: "Invalid 'name' in request body",
            details: "name must be a string with maximum 100 characters"
        });
        return;
    }

    next();
};

export const validateScriptUpdate = (req: Request, res: Response, next: NextFunction): void => {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim() || name.length > 100) {
        res.status(400).json({
            error: "Missing or invalid 'name' in request body",
            details: "name must be a non-empty string with maximum 100 characters"
        });
        return;
    }

    next();
}; 