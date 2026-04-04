import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ChessBoard.css";

type Player = "white" | "black";
type Piece = { symbol: string; player: Player };

const initialBoard = (): (Piece | null)[][] => {
  const board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  // Using uniform black unicodes for all pieces
  const backRank = ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"];
  for (let i = 0; i < 8; i++) {
    board[0][i] = { symbol: backRank[i], player: "black" };
    board[1][i] = { symbol: "♟", player: "black" };
    board[6][i] = { symbol: "♟", player: "white" };
    board[7][i] = { symbol: backRank[i], player: "white" };
  }
  return board;
};

const ChessBoard = () => {
  const [board, setBoard] = useState<(Piece | null)[][]>(initialBoard());
  const [gameStarted, setGameStarted] = useState(false);
  const [turn, setTurn] = useState<Player>("white");
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<[number, number][]>([]);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [inCheck, setInCheck] = useState<boolean>(false);
  

  const [movedStatus, setMovedStatus] = useState({
    whiteKing: false, whiteRook0: false, whiteRook7: false,
    blackKing: false, blackRook0: false, blackRook7: false
  });
  
  const [enPassantTarget, setEnPassantTarget] = useState<[number, number] | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{from: [number, number], to: [number, number]} | null>(null);
  const [capturedByWhite, setCapturedByWhite] = useState<string[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<string[]>([]);
  const [isTimed, setIsTimed] = useState(true);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = (mins: number | null) => {
  setBoard(initialBoard());
  setTurn("white");
  setGameOver(null);

  setSelected(null);
  setPossibleMoves([]);
  setInCheck(false);
  setEnPassantTarget(null);
  setPendingPromotion(null);

  setCapturedByWhite([]);
  setCapturedByBlack([]);

  setMovedStatus({
    whiteKing: false,
    whiteRook0: false,
    whiteRook7: false,
    blackKing: false,
    blackRook0: false,
    blackRook7: false
  });

  if (mins === null) {
    setIsTimed(false);
  } else {
    setIsTimed(true);
    setWhiteTime(mins * 60);
    setBlackTime(mins * 60);
  }

  setGameStarted(true);
};

  useEffect(() => {
    if (!gameStarted || gameOver || !isTimed) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      if (turn === "white") {
        setWhiteTime(t => (t <= 1 ? (setGameOver("WHITE OUT OF TIME"), 0) : t - 1));
      } else {
        setBlackTime(t => (t <= 1 ? (setGameOver("BLACK OUT OF TIME"), 0) : t - 1));
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [turn, gameOver, gameStarted, isTimed]);

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  const findKing = (player: Player, curBoard: (Piece | null)[][]): [number, number] => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = curBoard[r][c];
        if (p?.symbol === "♚" && p.player === player) return [r, c];
      }
    }
    return [-1, -1];
  };

  const isSquareUnderAttack = (row: number, col: number, attacker: Player, curBoard: (Piece | null)[][]) => {
    const knightSteps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    for (const [dr, dc] of knightSteps) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && curBoard[r][c]?.symbol === "♞" && curBoard[r][c]?.player === attacker) return true;
    }
    const dirs: [number, number, string[]][] = [
      [1,0,["♜","♛"]], [-1,0,["♜","♛"]], [0,1,["♜","♛"]], [0,-1,["♜","♛"]],
      [1,1,["♝","♛"]], [1,-1,["♝","♛"]], [-1,1,["♝","♛"]], [-1,-1,["♝","♛"]]
    ];
    for (const [dr, dc, targets] of dirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (curBoard[r][c]) {
          if (curBoard[r][c]?.player === attacker && targets.includes(curBoard[r][c]!.symbol)) return true;
          break;
        }
        r += dr; c += dc;
      }
    }
    const pDir = attacker === "white" ? 1 : -1;
    for (const dc of [-1, 1]) {
      const r = row + pDir, c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && curBoard[r][c]?.symbol === "♟" && curBoard[r][c]?.player === attacker) return true;
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && curBoard[r][c]?.symbol === "♚" && curBoard[r][c]?.player === attacker) return true;
      }
    }
    return false;
  };

  const simulateMove = (fR: number, fC: number, tR: number, tC: number, curBoard: (Piece | null)[][]) => {
    const temp = curBoard.map(r => [...r]);
    const p = temp[fR][fC];
    if (p?.symbol === "♟" && fC !== tC && !temp[tR][tC]) temp[fR][tC] = null;
    temp[tR][tC] = p;
    temp[fR][fC] = null;
    if (p?.symbol === "♚" && Math.abs(tC - fC) === 2) {
      if (tC === 6) { temp[fR][5] = temp[fR][7]; temp[fR][7] = null; }
      else { temp[fR][3] = temp[fR][0]; temp[fR][0] = null; }
    }
    return temp;
  };

  const executeMove = (fR: number, fC: number, tR: number, tC: number, sym: string) => {
    const newBoard = board.map(r => [...r]);
    let captured = newBoard[tR][tC];
    if (!captured && board[fR][fC]?.symbol === "♟" && fC !== tC) {
      captured = newBoard[fR][tC];
      newBoard[fR][tC] = null;
    }
    if (captured) {
      if (turn === "white") setCapturedByWhite(p => [...p, captured!.symbol]);
      else setCapturedByBlack(p => [...p, captured!.symbol]);
    }
    newBoard[tR][tC] = { symbol: sym, player: turn };
    newBoard[fR][fC] = null;
    if (sym === "♚" && Math.abs(tC - fC) === 2) {
      if (tC === 6) { newBoard[fR][5] = newBoard[fR][7]; newBoard[fR][7] = null; }
      else { newBoard[fR][3] = newBoard[fR][0]; newBoard[fR][0] = null; }
    }
    setEnPassantTarget(sym === "♟" && Math.abs(tR - fR) === 2 ? [tR, tC] : null);
    
    const ns = { ...movedStatus };
    if (fR === 7 && fC === 4) ns.whiteKing = true;
    if (fR === 7 && fC === 0) ns.whiteRook0 = true;
    if (fR === 7 && fC === 7) ns.whiteRook7 = true;
    if (fR === 0 && fC === 4) ns.blackKing = true;
    if (fR === 0 && fC === 0) ns.blackRook0 = true;
    if (fR === 0 && fC === 7) ns.blackRook7 = true;
    setMovedStatus(ns);
    setBoard(newBoard);
    setSelected(null);
    setPossibleMoves([]);
    setTurn(turn === "white" ? "black" : "white");
    setPendingPromotion(null);
  };

  const getRawMoves = useCallback((
  row: number,
  col: number,
  symbol: string,
  player: Player,
  curBoard: (Piece | null)[][]
): [number, number][] => {
    let m: [number, number][] = [];
    if (symbol === "♟") {
      const d = player === "white" ? -1 : 1;
      if (curBoard[row+d]?.[col] === null) m.push([row+d, col]);
      if (((player==="white"&&row===6)||(player==="black"&&row===1)) && curBoard[row+d]?.[col]===null && curBoard[row+2*d]?.[col]===null) m.push([row+2*d, col]);
      for (let off of [-1, 1]) {
        if (curBoard[row+d]?.[col+off] && curBoard[row+d][col+off]?.player !== player) m.push([row+d, col+off]);
        if (!curBoard[row+d]?.[col+off] && enPassantTarget && enPassantTarget[0]===row && enPassantTarget[1]===col+off) m.push([row+d, col+off]);
      }
    } else if (symbol === "♞") {
      [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr,dc]) => {
        const r=row+dr, c=col+dc;
        if (r>=0&&r<8&&c>=0&&c<8&&curBoard[r][c]?.player!==player) m.push([r,c]);
      });
    } else if (["♜","♝","♛"].includes(symbol)) {
      const ds: Record<string, [number, number][]> = {
        "♜": [[1,0],[-1,0],[0,1],[0,-1]], "♝": [[1,1],[1,-1],[-1,1],[-1,-1]],
        "♛": [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
      };
      ds[symbol].forEach(([dr,dc]) => {
        let r=row+dr, c=col+dc;
        while (r>=0&&r<8&&c>=0&&c<8) {
          if (!curBoard[r][c]) m.push([r,c]);
          else { if (curBoard[r][c]?.player!==player) m.push([r,c]); break; }
          r+=dr; c+=dc;
        }
      });
    } else if (symbol === "♚") {
      for (let r=-1;r<=1;r++) for(let c=-1;c<=1;c++) {
        const nr=row+r, nc=col+c;
        if ((r===0&&c===0)||nr<0||nr>7||nc<0||nc>7) continue;
        if (curBoard[nr][nc]?.player!==player) m.push([nr,nc]);
      }
      const enemy = player === "white" ? "black" : "white";
      if (!inCheck) {
        if (player === "white" && !movedStatus.whiteKing) {
          if (!movedStatus.whiteRook7 && !curBoard[7][5] && !curBoard[7][6] && !isSquareUnderAttack(7,5,enemy,curBoard) && !isSquareUnderAttack(7,6,enemy,curBoard)) m.push([7,6]);
          if (!movedStatus.whiteRook0 && !curBoard[7][1] && !curBoard[7][2] && !curBoard[7][3] && !isSquareUnderAttack(7,3,enemy,curBoard) && !isSquareUnderAttack(7,2,enemy,curBoard)) m.push([7,2]);
        } else if (player === "black" && !movedStatus.blackKing) {
          if (!movedStatus.blackRook7 && !curBoard[0][5] && !curBoard[0][6] && !isSquareUnderAttack(0,5,enemy,curBoard) && !isSquareUnderAttack(0,6,enemy,curBoard)) m.push([0,6]);
          if (!movedStatus.blackRook0 && !curBoard[0][1] && !curBoard[0][2] && !curBoard[0][3] && !isSquareUnderAttack(0,3,enemy,curBoard) && !isSquareUnderAttack(0,2,enemy,curBoard)) m.push([0,2]);
        }
      }
    }
    return m;
  }, [enPassantTarget, movedStatus, inCheck]);

  useEffect(() => {
    const kingPos = findKing(turn, board);
    const enemy = turn === "white" ? "black" : "white";
    const currentlyInCheck = isSquareUnderAttack(kingPos[0], kingPos[1], enemy, board);
    setInCheck(currentlyInCheck);
    let hasLegal = false;
    for (let r=0; r<8; r++) {
      for (let c=0; c<8; c++) {
        if (board[r][c]?.player === turn) {
          const raw = getRawMoves(r, c, board[r][c]!.symbol, turn, board);
          const legal = raw.filter(([tr, tc]) => {
            const temp = simulateMove(r, c, tr, tc, board);
            const [kr, kc] = findKing(turn, temp);
            return !isSquareUnderAttack(kr, kc, enemy, temp);
          });
          if (legal.length > 0) { hasLegal = true; break; }
        }
      }
      if (hasLegal) break;
    }
    if (!hasLegal) setGameOver(currentlyInCheck ? `CHECKMATE! ${enemy.toUpperCase()} WINS` : "STALEMATE!");
  }, [board, turn, getRawMoves]);

  const handleClick = (r: number, c: number) => {
    if (gameOver || !gameStarted) return;
    const piece = board[r][c];
    if (piece?.player === turn) {
      setSelected([r, c]);
      const raw = getRawMoves(r, c, piece.symbol, turn, board);
      setPossibleMoves(raw.filter(([tr, tc]) => {
        const temp = simulateMove(r, c, tr, tc, board);
        const [kr, kc] = findKing(turn, temp);
        return !isSquareUnderAttack(kr, kc, turn === "white" ? "black" : "white", temp);
      }));
    } else if (selected) {
      if (possibleMoves.some(([tr, tc]) => tr === r && tc === c)) {
        const p = board[selected[0]][selected[1]];
        if (p?.symbol === "♟" && (r === 0 || r === 7)) setPendingPromotion({ from: selected, to: [r, c] });
        else executeMove(selected[0], selected[1], r, c, p!.symbol);
      } else { setSelected(null); setPossibleMoves([]); }
    }
  };

  if (!gameStarted) {
    return (
      <div className="setup-screen">
        <h1>Select Timer</h1>
        <div className="setup-buttons">
          <button onClick={() => startGame(5)}>5 MIN</button>
          <button onClick={() => startGame(10)}>10 MIN</button>
          <button onClick={() => startGame(null)}>UNLIMITED</button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout">
      <div className="board-container">
        <div className="status-bar">
          {gameOver ? <h2 className="game-over">{gameOver}</h2> : 
          <h2 className="turn-text">TURN: {turn.toUpperCase()} {inCheck && <span className="check-warning"> (CHECK!)</span>}</h2>}
        </div>
        
        <button className="reset-btn" onClick={() => setGameStarted(false)}>
          RESET GAME
        </button>

        <div className={`board ${gameOver ? "faded" : ""}`}>
          {board.map((rowArr, r) => rowArr.map((piece, c) => {
            const isPossible = possibleMoves.some(([tr, tc]) => tr === r && tc === c);
           
            return (
              <div 
                key={`${r}-${c}`} 
                className={`square ${(r+c)%2===1 ? "black-square" : "white-square"} 
                  ${selected?.[0]===r && selected?.[1]===c ? "selected" : ""} 
                  ${isPossible ? (piece?"capture":"possible") : ""} 
                  ${piece?.symbol==="♚" && piece.player===turn && inCheck ? "check-highlight" : ""}`}
                onClick={() => handleClick(r, c)}
              >
                <span className={piece?.player === "white" ? "white-piece" : "black-piece"}>{piece?.symbol}</span>
              </div>
            );
          }))}
        </div>
      </div>

      <aside className="sidebar-right">
        {isTimed && (
          <div className="clock-container">
            <div className={`clock ${turn==="black"?"active-clock":""}`}>
              <span>BLACK: </span><strong>{formatTime(blackTime)}</strong>
            </div>
            <div className={`clock ${turn==="white"?"active-clock":""}`}>
              <span>WHITE: </span><strong>{formatTime(whiteTime)}</strong>
            </div>
          </div>
        )}
        <div className="capture-box">
          <h4>WHITE CAPTURES</h4>
          <div className="captured-list">{capturedByWhite.map((s, i) => <span key={i} className="black-piece small-piece">{s}</span>)}</div>
        </div>
        <div className="capture-box">
          <h4>BLACK CAPTURES</h4>
          <div className="captured-list">{capturedByBlack.map((s, i) => <span key={i} className="white-piece small-piece">{s}</span>)}</div>
        </div>
      </aside>

      {pendingPromotion && (
        <div className="promotion-overlay">
          <h3>PROMOTE TO:</h3>
          <div className="promotion-buttons">
            {["♛", "♜", "♝", "♞"].map(s => <button key={s} onClick={() => executeMove(pendingPromotion.from[0], pendingPromotion.from[1], pendingPromotion.to[0], pendingPromotion.to[1], s)}>{s}</button>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChessBoard;