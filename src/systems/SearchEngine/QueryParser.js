// QueryParser - Boolean search parsing logic
// Supports: , (AND), ~ (OR), - (NOT), parentheses, rating expressions

/**
 * Parse a query string into an Abstract Syntax Tree
 * @param {string} query - Query string to parse
 * @returns {object} ParsedQuery AST
 */
function parse(query) {
  if (!query || typeof query !== 'string') {
    return { type: 'empty' };
  }

  const tokens = tokenize(query.trim());
  if (tokens.length === 0) {
    return { type: 'empty' };
  }

  try {
    const ast = parseExpression(tokens, 0);
    return ast.node;
  } catch (error) {
    return { type: 'error', error: error.message };
  }
}

/**
 * Tokenize query string into array of tokens
 * @param {string} query - Query string
 * @returns {array} Array of token objects
 */
function tokenize(query) {
  const tokens = [];
  let i = 0;
  
  while (i < query.length) {
    const char = query[i];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // Operators
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
    } else if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
    } else if (char === ',') {
      tokens.push({ type: 'AND', value: ',' });
      i++;
    } else if (char === '~') {
      tokens.push({ type: 'OR', value: '~' });
      i++;
    } else if (char === '-') {
      tokens.push({ type: 'NOT', value: '-' });
      i++;
    } else if (char === 's' && i + 7 < query.length && query.substring(i, i + 7) === 'series:') {
      // Series expression: series:collection_name
      let j = i + 7;
      while (j < query.length && query[j] !== ' ' && query[j] !== ',' && query[j] !== ')' && query[j] !== '~') {
        j++;
      }
      
      const collectionName = query.substring(i + 7, j).trim();
      if (collectionName) {
        tokens.push({
          type: 'SERIES',
          value: collectionName,
          pos: i
        });
        i = j;
      } else {
        // Invalid series syntax, treat as term
        const termMatch = query.slice(i).match(/^[^\s(),~-]+/);
        if (termMatch) {
          tokens.push({ type: 'TERM', value: termMatch[0] });
          i += termMatch[0].length;
        } else {
          i++;
        }
      }
    } else if (char === 'r' && i + 1 < query.length && /[><=?]/.test(query[i + 1])) {
      // Rating expression: r>80, r<50, r=0, r?
      const ratingMatch = query.slice(i).match(/^r([><=?])(\d+|$)/);
      if (ratingMatch) {
        const operator = ratingMatch[1];
        const value = ratingMatch[2] ? parseInt(ratingMatch[2]) : null;
        tokens.push({ 
          type: 'RATING', 
          value: `r${operator}${value || ''}`,
          operator: operator,
          ratingValue: value
        });
        i += ratingMatch[0].length;
      } else {
        // Just 'r' by itself, treat as term
        const termMatch = query.slice(i).match(/^[^\s(),~-]+/);
        if (termMatch) {
          tokens.push({ type: 'TERM', value: termMatch[0] });
          i += termMatch[0].length;
        } else {
          i++;
        }
      }
    } else {
      // Regular term
      const termMatch = query.slice(i).match(/^[^\s(),~-]+/);
      if (termMatch) {
        tokens.push({ type: 'TERM', value: termMatch[0] });
        i += termMatch[0].length;
      } else {
        i++;
      }
    }
  }
  
  return tokens;
}

/**
 * Parse expression with precedence handling
 * @param {array} tokens - Array of tokens
 * @param {number} pos - Current position
 * @returns {object} { node: AST node, pos: new position }
 */
function parseExpression(tokens, pos) {
  return parseOR(tokens, pos);
}

/**
 * Parse OR expressions (lowest precedence)
 * @param {array} tokens - Array of tokens
 * @param {number} pos - Current position
 * @returns {object} { node: AST node, pos: new position }
 */
function parseOR(tokens, pos) {
  let result = parseAND(tokens, pos);
  
  while (result.pos < tokens.length && tokens[result.pos].type === 'OR') {
    const operator = tokens[result.pos];
    const right = parseAND(tokens, result.pos + 1);
    
    result = {
      node: {
        type: 'OR',
        left: result.node,
        right: right.node
      },
      pos: right.pos
    };
  }
  
  return result;
}

/**
 * Parse AND expressions (medium precedence)
 * @param {array} tokens - Array of tokens
 * @param {number} pos - Current position
 * @returns {object} { node: AST node, pos: new position }
 */
function parseAND(tokens, pos) {
  let result = parseNOT(tokens, pos);
  
  while (result.pos < tokens.length && 
         (tokens[result.pos].type === 'AND' || 
          (tokens[result.pos].type === 'TERM' || 
           tokens[result.pos].type === 'RATING' || 
           tokens[result.pos].type === 'SERIES' || 
           tokens[result.pos].type === 'LPAREN'))) {
    
    let operator = null;
    let nextPos = result.pos;
    
    if (tokens[result.pos].type === 'AND') {
      operator = tokens[result.pos];
      nextPos = result.pos + 1;
    } else {
      // Implicit AND (adjacent terms)
      operator = { type: 'AND', value: 'implicit' };
      nextPos = result.pos;
    }
    
    const right = parseNOT(tokens, nextPos);
    
    result = {
      node: {
        type: 'AND',
        left: result.node,
        right: right.node
      },
      pos: right.pos
    };
  }
  
  return result;
}

/**
 * Parse NOT expressions (high precedence)
 * @param {array} tokens - Array of tokens
 * @param {number} pos - Current position
 * @returns {object} { node: AST node, pos: new position }
 */
function parseNOT(tokens, pos) {
  if (pos < tokens.length && tokens[pos].type === 'NOT') {
    const operand = parsePrimary(tokens, pos + 1);
    return {
      node: {
        type: 'NOT',
        operand: operand.node
      },
      pos: operand.pos
    };
  }
  
  return parsePrimary(tokens, pos);
}

/**
 * Parse primary expressions (highest precedence)
 * @param {array} tokens - Array of tokens
 * @param {number} pos - Current position
 * @returns {object} { node: AST node, pos: new position }
 */
function parsePrimary(tokens, pos) {
  if (pos >= tokens.length) {
    throw new Error('Unexpected end of query');
  }
  
  const token = tokens[pos];
  
  if (token.type === 'LPAREN') {
    const expr = parseExpression(tokens, pos + 1);
    if (expr.pos >= tokens.length || tokens[expr.pos].type !== 'RPAREN') {
      throw new Error('Missing closing parenthesis');
    }
    return {
      node: expr.node,
      pos: expr.pos + 1
    };
  }
  
  if (token.type === 'TERM') {
    return {
      node: {
        type: 'TERM',
        value: token.value.toLowerCase()
      },
      pos: pos + 1
    };
  }
  
  if (token.type === 'RATING') {
    return {
      node: {
        type: 'RATING',
        operator: token.operator,
        value: token.ratingValue
      },
      pos: pos + 1
    };
  }
  
  if (token.type === 'SERIES') {
    return {
      node: {
        type: 'SERIES',
        value: token.value.toLowerCase()
      },
      pos: pos + 1
    };
  }
  
  throw new Error(`Unexpected token: ${token.value}`);
}

export {
  parse,
  tokenize
};
