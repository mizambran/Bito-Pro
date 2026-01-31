import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Form, Table, Button, Badge, Pagination, Modal, Spinner 
} from 'react-bootstrap';
import { 
  Calculator, Save, Trash2, Edit, RefreshCw, TrendingUp, 
  ArrowRight, Moon, Sun, Eye, Clock, CheckCircle, FileSpreadsheet, Network, BarChart2, Zap, XCircle 
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2'; 
import * as XLSX from 'xlsx';   
import '../App.css'; 

// ============================================================================
// UTILITIES
// ============================================================================

const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return "$0.00";
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4
    }).format(amount);
};

const formatTime = (date) => {
    return date.toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// ============================================================================
// COMPONENT: CALCULATOR FORM
// ============================================================================
const CalculatorForm = ({ form, setForm, results, isEditMode = false, onSave, onCancel, onClear, theme }) => (
    <Form>
        <Form.Group className="mb-3">
            <Form.Label className="text-label">Nombre de Referencia</Form.Label>
            <Form.Control 
                type="text" 
                placeholder="Ej: Arb BTC Tarde" 
                className="form-control-custom"
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
            />
        </Form.Group>

        <Row className="g-3 mb-3">
            {/* LEFT: BUY */}
            <Col md={6}>
                <div className="p-3 rounded border border-danger border-opacity-25 bg-danger bg-opacity-10">
                    <h6 className="text-danger fw-bold mb-2"><ArrowRight size={16}/> COMPRA (Origen)</h6>
                    <Row className="g-2">
                        <Col xs={7}>
                            <span className="text-label d-block">Precio Compra</span>
                            <Form.Control type="number" size="sm" className="form-control-custom"
                                value={form.buyPrice} onChange={e => setForm({...form, buyPrice: parseFloat(e.target.value) || 0})}
                            />
                        </Col>
                        <Col xs={5}>
                            <span className="text-label d-block">Comisión %</span>
                            <Form.Control type="number" size="sm" className="form-control-custom"
                                value={form.feeBuy} onChange={e => setForm({...form, feeBuy: parseFloat(e.target.value) || 0})}
                            />
                        </Col>
                    </Row>
                </div>
            </Col>
            
            {/* RIGHT: SELL */}
            <Col md={6}>
                <div className="p-3 rounded border border-success border-opacity-25 bg-success bg-opacity-10">
                    <h6 className="text-success fw-bold mb-2"><ArrowRight size={16}/> VENTA (Destino)</h6>
                    <Row className="g-2">
                        <Col xs={7}>
                            <span className="text-label d-block">Precio Venta</span>
                            <Form.Control type="number" size="sm" className="form-control-custom"
                                value={form.sellPrice} onChange={e => setForm({...form, sellPrice: parseFloat(e.target.value) || 0})}
                            />
                        </Col>
                        <Col xs={5}>
                            <span className="text-label d-block">Comisión %</span>
                            <Form.Control type="number" size="sm" className="form-control-custom"
                                value={form.feeSell} onChange={e => setForm({...form, feeSell: parseFloat(e.target.value) || 0})}
                            />
                        </Col>
                    </Row>
                </div>
            </Col>
        </Row>

        <Row className="align-items-end g-3">
            <Col md={4}>
                <Form.Label className="text-label">Cantidad (Volumen)</Form.Label>
                <Form.Control type="number" className="form-control-custom py-2 fw-bold"
                    value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})}
                />
            </Col>
            <Col md={4}>
                <Form.Label className="text-label d-flex align-items-center gap-1">
                    Costo Red ($) <Network size={14}/>
                </Form.Label>
                <Form.Control type="number" className="form-control-custom" placeholder="0.00"
                    value={form.transferFee} onChange={e => setForm({...form, transferFee: parseFloat(e.target.value) || 0})}
                />
            </Col>
            <Col md={4}>
                <div className={`p-2 rounded border text-center ${theme === 'dark' ? 'border-secondary bg-black bg-opacity-25' : 'border-secondary bg-light'}`}>
                    <span className="text-secondary small d-block">Ganancia Estimada</span>
                    <span className={`fs-5 fw-bold ${results.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatMoney(results.profit)}
                    </span>
                </div>
            </Col>
        </Row>

        <hr className="my-4 border-secondary"/>
        
        <div className="d-flex gap-2">
            <Button variant={isEditMode ? "info" : "success"} className="w-100 fw-bold" onClick={() => onSave(isEditMode)}>
                <Save size={18} className="me-2"/> {isEditMode ? 'Guardar Cambios' : 'Registrar Operación'}
            </Button>
            
            {isEditMode ? (
                <Button variant="secondary" onClick={onCancel} className="d-flex align-items-center gap-1">
                    <XCircle size={18}/> Cancelar Edición
                </Button>
            ) : (
                <Button variant="outline-secondary" onClick={onClear} className="d-flex align-items-center gap-1">
                     <Trash2 size={16}/> Cancelar / Limpiar
                </Button>
            )}
        </div>
    </Form>
);

// ============================================================================
// MAIN COMPONENT: ARBITRAGE DASHBOARD
// ============================================================================
const ArbitrageDashboard = () => {
  // --- STATES ---
  const [theme, setTheme] = useState('dark');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  const [opportunities, setOpportunities] = useState([]);
  const [allTickers, setAllTickers] = useState([]);
  const [isLoading, setIsLoading] = useState(false); 

  const [filters, setFilters] = useState({ currency: 'ALL', exchange: 'ALL', type: 'ALL', isP2P: false });
  const [monitorCoin, setMonitorCoin] = useState('BTC'); 

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; 
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 5;

  const initialCalcState = { id: null, name: '', buyPrice: 0, sellPrice: 0, amount: 1, feeBuy: 0.1, feeSell: 0.1, transferFee: 0 };
  const [calcForm, setCalcForm] = useState(initialCalcState);
  
  const [editForm, setEditForm] = useState(initialCalcState);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [savedOperations, setSavedOperations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedOp, setSelectedOp] = useState(null);

  // --- EFFECTS ---
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
  }, [theme]);

  useEffect(() => {
    handleRefresh(); 
    const stored = localStorage.getItem('bitoPro_operations');
    if (stored) setSavedOperations(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem('bitoPro_operations', JSON.stringify(savedOperations));
  }, [savedOperations]);


  // --- DYNAMIC LISTS ---
  const availableExchanges = [...new Set(allTickers.map(t => capitalize(t.exchange)))].sort();
  const availableCoins = [...new Set(allTickers.map(t => t.symbol.split('/')[0]))].sort();

  const swalConfig = {
    background: theme === 'dark' ? '#1e2329' : '#fff',
    color: theme === 'dark' ? '#eaecef' : '#1f2937',
    confirmButtonColor: '#0d6efd',
    cancelButtonColor: '#dc3545',
  };

  // --- API CONNECTION ---
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
        const response = await fetch('http://localhost:5000/api/opportunities');
        const data = await response.json();

        if (data) {
            setOpportunities(data.opportunities || []);
            setAllTickers(data.tickers || []);
            setLastUpdated(new Date());
            
            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, ...swalConfig
            });
            Toast.fire({ icon: 'success', title: `Scanner completado.` });
        }
    } catch (error) {
        console.error("Error backend:", error);
        Swal.fire({
            ...swalConfig,
            icon: 'error',
            title: 'Error de Conexión',
            text: 'Revisa que el servidor backend esté corriendo en el puerto 5000.'
        });
    } finally {
        setIsLoading(false);
    }
  };

  // --- EXCEL EXPORT ---
  const handleExportExcel = () => {
    if (savedOperations.length === 0) return Swal.fire({ ...swalConfig, icon: 'info', title: 'Sin datos' });

    const dataToExport = savedOperations.map(op => {
        const buyFeeUSD = (op.amount * op.buyPrice * (op.feeBuy / 100));
        const sellFeeUSD = (op.amount * op.sellPrice * (op.feeSell / 100));
        return {
            Referencia: op.name,
            Fecha: op.date,
            Par: 'BTC/USDT', 
            Precio_Compra: op.buyPrice,
            Precio_Venta: op.sellPrice,
            Volumen: op.amount,
            Comision_Compra_Pct: `${op.feeBuy}%`,
            Comision_Compra_USD: buyFeeUSD.toFixed(2),
            Comision_Venta_Pct: `${op.feeSell}%`,
            Comision_Venta_USD: sellFeeUSD.toFixed(2),
            Costo_Red: op.transferFee || 0,
            Inversion_Total: op.results.cost.toFixed(2),
            Ganancia_Neta: op.results.profit.toFixed(2),
            ROI: `${op.results.profitPercent.toFixed(2)}%`
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, `BitoPro_Reporte_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    Swal.fire({ ...swalConfig, icon: 'success', title: 'Exportado correctamente' });
  };

  // --- CALCULATOR LOGIC ---
  const calculateResult = (form) => {
    const buyCostRaw = form.amount * form.buyPrice;
    const buyFeeVal = buyCostRaw * (form.feeBuy / 100);
    const totalInvestment = buyCostRaw + buyFeeVal + (form.transferFee || 0);

    const sellRevenueRaw = form.amount * form.sellPrice;
    const sellFeeVal = sellRevenueRaw * (form.feeSell / 100);
    const netRevenue = sellRevenueRaw - sellFeeVal;

    const profit = netRevenue - totalInvestment;
    const profitPercent = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
    
    return { cost: totalInvestment, revenue: netRevenue, profit, profitPercent };
  };
  
  const currentResults = calculateResult(calcForm);
  const editResults = calculateResult(editForm);

  // --- CRUD ---
  const handleSaveOperation = (isEdit = false) => {
    const targetForm = isEdit ? editForm : calcForm;
    if (!targetForm.name) return Swal.fire({ ...swalConfig, icon: 'warning', title: 'Falta nombre' });
    
    const operationData = {
      ...targetForm,
      id: targetForm.id || uuidv4(),
      results: calculateResult(targetForm),
      date: isEdit ? targetForm.date : new Date().toLocaleString()
    };

    if (isEdit) {
      setSavedOperations(prev => prev.map(op => op.id === targetForm.id ? operationData : op));
      setShowEditModal(false);
      Swal.fire({ ...swalConfig, icon: 'success', title: 'Actualizado', timer: 1500, showConfirmButton: false });
    } else {
      setSavedOperations(prev => [operationData, ...prev]);
      setCalcForm(initialCalcState);
      Swal.fire({ 
          ...swalConfig, icon: 'success', title: 'Guardado', 
          showCancelButton: true, confirmButtonText: 'Ver Detalles', cancelButtonText: 'Seguir' 
      }).then((r) => { if (r.isConfirmed) openDetailModal(operationData); });
    }
  };

  const handleClearCalculator = () => {
      setCalcForm(initialCalcState);
  };

  const deleteOperation = (id) => {
    Swal.fire({ 
        ...swalConfig, title: '¿Borrar operación?', icon: 'warning', 
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, borrar' 
    }).then((r) => {
        if (r.isConfirmed) { 
            setSavedOperations(prev => prev.filter(op => op.id !== id)); 
            Swal.fire({ ...swalConfig, title: 'Borrado', icon: 'success', timer: 1000, showConfirmButton: false }); 
        }
    });
  };

  const openEditModal = (op) => { setEditForm({ ...op }); setShowEditModal(true); };
  const openDetailModal = (op) => { setSelectedOp({ ...op, results: calculateResult(op) }); setShowModal(true); };
  
  const loadFromOpportunity = (op) => {
    setCalcForm(prev => ({
        ...prev, 
        buyPrice: op.buyPrice, 
        sellPrice: op.sellPrice, 
        amount: 1, 
        name: op.type === 'Triangular' ? op.pair : `Arb ${op.pair} [${op.exchangeBuy} -> ${op.exchangeSell}]`
    }));
    document.getElementById('calculator-area').scrollIntoView({ behavior: 'smooth' });
  };

  const loadFromMonitor = (ticker, type) => {
      if(type === 'buy') setCalcForm(prev => ({ ...prev, buyPrice: ticker.ask }));
      else setCalcForm(prev => ({ ...prev, sellPrice: ticker.bid }));
      document.getElementById('calculator-area').scrollIntoView({ behavior: 'smooth' });
  };
  
  const loadBestOpportunity = (buyTicker, sellTicker) => {
      setCalcForm(prev => ({
          ...prev, buyPrice: buyTicker.ask, sellPrice: sellTicker.bid, amount: 1,
          name: `Arb ${monitorCoin} [${buyTicker.exchange} -> ${sellTicker.exchange}]`
      }));
      document.getElementById('calculator-area').scrollIntoView({ behavior: 'smooth' });
  };

  // --- FILTER LOGIC ---
  const filteredOpportunities = opportunities.filter(op => {
    if (filters.currency !== 'ALL' && !op.pair.includes(filters.currency) && !op.pair.includes('Tri')) return false;
    if (filters.exchange !== 'ALL') {
         if(op.exchangeBuy !== filters.exchange && op.exchangeSell !== filters.exchange) return false;
    }
    if (filters.type !== 'ALL' && op.type !== filters.type) return false;
    if (filters.isP2P && !op.isP2P) return false;
    return true;
  }).sort((a, b) => b.spread - a.spread);

  const currentItems = filteredOpportunities.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);

  const monitorTickers = allTickers.filter(t => t.symbol.startsWith(monitorCoin));
  const bestAsk = monitorTickers.length > 0 ? Math.min(...monitorTickers.map(t => t.ask)) : 0;
  const bestBid = monitorTickers.length > 0 ? Math.max(...monitorTickers.map(t => t.bid)) : 0;
  
  const bestBuyTicker = monitorTickers.find(t => t.ask === bestAsk);
  const bestSellTicker = monitorTickers.find(t => t.bid === bestBid);
  const monitorSpread = bestAsk > 0 ? ((bestBid - bestAsk) / bestAsk) * 100 : 0;

  const sortedHistory = [...savedOperations].sort((a, b) => new Date(b.date) - new Date(a.date));
  const currentHistoryItems = sortedHistory.slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage);
  const totalHistoryPages = Math.ceil(sortedHistory.length / historyItemsPerPage);


  return (
    <Container fluid className="py-4 app-container min-vh-100">
      
      {/* 1. HEADER */}
      <Row className="mb-4 align-items-center justify-content-between g-3">
        <Col md={4}>
          <h2 className={`fw-bold m-0 d-flex align-items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-dark'}`}>
            <TrendingUp className="text-warning" size={32} /> 
            Bito Pro <Badge bg={theme === 'dark' ? 'secondary' : 'dark'} className="fw-normal fs-6">v3.0</Badge>
          </h2>
        </Col>

        <Col md={8} className="d-flex justify-content-md-end align-items-center gap-3 flex-wrap">
            <div className="d-flex align-items-center gap-2 text-secondary bg-card-custom px-3 py-2 rounded border border-secondary border-opacity-25">
                <Clock size={16} /> <span className="small fw-semibold">{formatTime(lastUpdated)}</span>
                <Button variant="link" className="p-0 text-primary ms-2" onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </Button>
            </div>
            <Button variant={theme === 'dark' ? 'outline-light' : 'outline-dark'} onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} className="d-flex align-items-center gap-2 btn-sm">
                {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
            </Button>
        </Col>
      </Row>

      {/* 2. MONITOR INDIVIDUAL */}
      <Card className="card-custom mb-4 border-primary border-opacity-25 position-relative overflow-hidden">
        <Card.Body>
            {isLoading && (<div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75" style={{zIndex: 50}}><Spinner animation="border" variant="primary" /></div>)}

            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <h5 className="mb-0 fw-bold d-flex align-items-center gap-2 text-primary"><BarChart2 size={20}/> Monitor Individual</h5>
                <Form.Select className="form-control-custom w-auto" value={monitorCoin} onChange={(e) => setMonitorCoin(e.target.value)} disabled={isLoading || availableCoins.length === 0}>
                    {availableCoins.length > 0 ? availableCoins.map(c => <option key={c} value={c}>{c}</option>) : <option>Cargando...</option>}
                </Form.Select>
            </div>
            
            {/* Flash Card */}
            {bestBuyTicker && bestSellTicker && !isLoading && (
                <div className={`mb-4 p-3 rounded border d-flex justify-content-center ${theme === 'dark' ? 'bg-dark border-secondary' : 'bg-light border-light'}`}>
                    <div className="d-flex flex-wrap align-items-center gap-4 justify-content-center text-center">
                        <div className="text-center">
                            <small className="d-block text-secondary mb-1">Mejor Compra</small>
                            <Badge bg="danger" className="text-uppercase px-2 py-1 mb-1">{bestBuyTicker.exchange}</Badge>
                            <div className="fw-bold text-danger">{formatMoney(bestBuyTicker.ask)}</div>
                        </div>
                        <ArrowRight className="text-muted d-none d-md-block"/>
                        <div className="text-center">
                            <small className="d-block text-secondary mb-1">Mejor Venta</small>
                            <Badge bg="success" className="text-uppercase px-2 py-1 mb-1">{bestSellTicker.exchange}</Badge>
                            <div className="fw-bold text-success">{formatMoney(bestSellTicker.bid)}</div>
                        </div>
                        <div className="vr d-none d-md-block mx-2 text-secondary"></div>
                        <div className="text-center ps-md-2">
                            <small className="d-block text-secondary mb-1">Diferencia Potencial</small>
                            <h3 className={`m-0 fw-bold ${monitorSpread > 0 ? 'text-warning' : 'text-muted'}`}>
                                {monitorSpread > 0 ? '+' : ''}{monitorSpread.toFixed(2)}%
                            </h3>
                            {monitorSpread > 0 && (<Button size="sm" variant="link" className="p-0 text-decoration-none text-primary mt-1" onClick={() => loadBestOpportunity(bestBuyTicker, bestSellTicker)}>Calcular esto <Zap size={14}/></Button>)}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Table */}
            <div className="table-responsive">
                <Table className="table-custom mb-0 text-center" bordered hover size="sm">
                    <thead><tr><th>Exchange</th><th>Compra (Ask)</th><th>Venta (Bid)</th><th>Acción</th></tr></thead>
                    <tbody style={{opacity: isLoading ? 0.3 : 1}}>
                        {monitorTickers.length > 0 ? monitorTickers.map((t, idx) => (
                            <tr key={`${t.exchange}-${idx}`}>
                                <td className="fw-bold text-uppercase">{t.exchange}</td>
                                <td className={t.ask === bestAsk ? "bg-success bg-opacity-25 fw-bold text-success border-success" : ""}>{formatMoney(t.ask)}{t.ask === bestAsk && <Badge bg="success" className="ms-2">MEJOR</Badge>}</td>
                                <td className={t.bid === bestBid ? "bg-danger bg-opacity-25 fw-bold text-danger border-danger" : ""}>{formatMoney(t.bid)}{t.bid === bestBid && <Badge bg="danger" className="ms-2">MEJOR</Badge>}</td>
                                <td><div className="d-flex justify-content-center gap-2"><Button size="sm" variant="outline-success" onClick={() => loadFromMonitor(t, 'buy')} disabled={isLoading}>C</Button><Button size="sm" variant="outline-danger" onClick={() => loadFromMonitor(t, 'sell')} disabled={isLoading}>V</Button></div></td>
                            </tr>
                        )) : <tr><td colSpan="4" className="text-muted py-3">{isLoading ? "Consultando..." : "No hay datos."}</td></tr>}
                    </tbody>
                </Table>
            </div>
        </Card.Body>
      </Card>

      {/* 3. FILTERS (PROTECTED WITH SPINNER) */}
      <Card className="card-custom mb-4 position-relative overflow-hidden">
        {isLoading && (<div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75" style={{zIndex: 50}}><Spinner animation="border" variant="primary" size="sm"/></div>)}
        <Card.Body>
          <div className="d-flex align-items-center gap-2 mb-3 text-secondary"><RefreshCw size={18} /> <span className="fw-semibold">Oportunidades Calculadas</span></div>
          <Form>
            <Row className="g-3">
              <Col lg={3} md={6}>
                <Form.Label className="text-label">Moneda</Form.Label>
                <Form.Select className="form-control-custom" value={filters.currency} onChange={e => setFilters({...filters, currency: e.target.value})} disabled={isLoading}><option value="ALL">Todas</option>{availableCoins.map(c => <option key={c} value={c}>{c}</option>)}</Form.Select>
              </Col>
              <Col lg={3} md={6}>
                <Form.Label className="text-label">Exchange</Form.Label>
                <Form.Select className="form-control-custom" value={filters.exchange} onChange={e => setFilters({...filters, exchange: e.target.value})} disabled={isLoading}><option value="ALL">Cualquiera</option>{availableExchanges.map(ex => <option key={ex} value={ex}>{ex}</option>)}</Form.Select>
              </Col>
              <Col lg={3} md={6}>
                <Form.Label className="text-label">Estrategia</Form.Label>
                <Form.Select className="form-control-custom" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} disabled={isLoading}>
                    <option value="ALL">Todas</option>
                    <option value="Espacial">Espacial (Clásico)</option>
                    <option value="Triangular">Triangular (BTC Bridge)</option>
                </Form.Select>
              </Col>
              <Col lg={3} md={6} className="d-flex align-items-end pb-2">
                <Form.Check type="switch" id="p2p-switch" label="Solo P2P" className="fs-6 fw-bold text-secondary" checked={filters.isP2P} onChange={e => setFilters({...filters, isP2P: e.target.checked})} disabled={isLoading}/>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {/* 4. OPPORTUNITY TABLE */}
      <Card className="card-custom mb-4 overflow-hidden position-relative" style={{minHeight: '400px'}}>
        {isLoading && (<div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75" style={{zIndex: 50}}><div className="text-center"><Spinner animation="border" variant="primary" className="mb-2"/><div className="text-light small">Escaneando mercado por lotes...</div></div></div>)}
        <Table hover responsive className="table-custom mb-0">
          <thead><tr><th>PAR</th><th>COMPRA</th><th>VENTA</th><th>SPREAD</th><th>TIPO</th><th className="text-end">ACCIÓN</th></tr></thead>
          <tbody style={{opacity: isLoading ? 0.3 : 1}}>
            {currentItems.length > 0 ? currentItems.map((op) => (
              <tr key={op.id}>
                <td className="fw-bold">{op.pair} {op.isP2P && <Badge bg="success" className="ms-2" style={{fontSize: '0.6rem'}}>P2P</Badge>}</td>
                <td><div className="text-danger fw-semibold">{op.exchangeBuy}</div><div className="small text-secondary">{formatMoney(op.buyPrice)}</div></td>
                <td><div className="text-success fw-semibold">{op.exchangeSell}</div><div className="small text-secondary">{formatMoney(op.sellPrice)}</div></td>
                <td className={`fw-bold ${parseFloat(op.spread) > 1.5 ? 'text-warning' : 'text-primary'}`}>{op.spread}%</td>
                <td className="text-secondary small">
                    {op.type === 'Triangular' ? <Badge bg="info">Triangular</Badge> : 'Espacial'}
                </td>
                <td className="text-end"><Button variant="primary" size="sm" onClick={() => loadFromOpportunity(op)} className="d-inline-flex align-items-center gap-1" disabled={isLoading}><Calculator size={14}/> Calcular</Button></td>
              </tr>
            )) : (<tr><td colSpan="6" className="text-center py-5 text-muted">{isLoading ? "Cargando..." : "No se encontraron oportunidades."}</td></tr>)}
          </tbody>
        </Table>
        <Card.Footer className="bg-transparent border-top border-secondary d-flex justify-content-between align-items-center py-2">
            <span className="text-secondary small">Pag {currentPage} de {totalPages}</span>
            <Pagination className="mb-0" size="sm"><Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} /><Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} /></Pagination>
        </Card.Footer>
      </Card>

      {/* 5. CALCULATOR & HISTORY */}
      <Row className="g-4" id="calculator-area">
        <Col lg={7}>
          <Card className="card-custom h-100">
            <div className="card-header-custom d-flex justify-content-between align-items-center"><span className="text-warning fw-bold d-flex align-items-center gap-2"><Calculator size={20}/> Nueva Operación</span></div>
            <Card.Body><CalculatorForm form={calcForm} setForm={setCalcForm} results={currentResults} onSave={handleSaveOperation} onClear={handleClearCalculator} theme={theme} /></Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="card-custom h-100">
            <div className="card-header-custom d-flex justify-content-between align-items-center"><span className="text-info fw-bold"><Save size={18} className="me-2 d-inline"/> Historial</span><Button variant="outline-success" size="sm" onClick={handleExportExcel} title="Exportar a Excel"><FileSpreadsheet size={16}/> Exportar</Button></div>
            <Card.Body className="p-2 d-flex flex-column justify-content-between" style={{minHeight: '450px'}}>
              <div className="overflow-auto">
              {savedOperations.length === 0 ? (<div className="text-center text-secondary py-5">Sin operaciones.</div>) : (
                  currentHistoryItems.map(op => (
                    <div key={op.id} className={`p-3 mb-2 rounded border d-flex justify-content-between align-items-center ${theme === 'dark' ? 'border-secondary bg-dark' : 'border-light bg-light'}`}>
                        <div><h6 className="mb-0 fw-bold text-primary text-truncate" style={{maxWidth: '150px'}}>{op.name}</h6><span className={`fw-bold small ${op.results.profit >= 0 ? 'text-success' : 'text-danger'}`}>ROI: {op.results.profitPercent.toFixed(2)}%</span></div>
                        <div className="d-flex gap-1"><Button variant="link" className="p-1 text-info" onClick={() => openDetailModal(op)}><Eye size={18}/></Button><Button variant="link" className="p-1 text-warning" onClick={() => openEditModal(op)}><Edit size={18}/></Button><Button variant="link" className="p-1 text-danger" onClick={() => deleteOperation(op.id)}><Trash2 size={18}/></Button></div>
                    </div>
                  ))
              )}
              </div>
              {savedOperations.length > 0 && (<div className="d-flex justify-content-center mt-3 pt-2 border-top border-secondary border-opacity-25"><Pagination size="sm" className="mb-0"><Pagination.Prev disabled={historyPage === 1} onClick={() => setHistoryPage(c => c - 1)} /><Pagination.Item active>{historyPage}</Pagination.Item><Pagination.Next disabled={historyPage === totalHistoryPages} onClick={() => setHistoryPage(c => c + 1)} /></Pagination></div>)}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 6. MODALS */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered className="modal-custom">
        <Modal.Header closeButton className="close-btn-custom"><Modal.Title className="fw-bold d-flex align-items-center gap-2"><CheckCircle className="text-success"/> Detalles</Modal.Title></Modal.Header>
        <Modal.Body>
            {selectedOp && (
                <div className="px-2">
                    <h5 className="text-center mb-4 text-primary fw-bold">{selectedOp.name}</h5>
                    <div className="d-flex justify-content-center gap-4 mb-4">
                        <div className="text-center p-3 rounded bg-opacity-10 bg-success border border-success w-50"><span className="d-block small text-secondary">Beneficio</span><span className="fs-3 fw-bold text-success">{formatMoney(selectedOp.results.profit)}</span></div>
                        <div className="text-center p-3 rounded bg-opacity-10 bg-info border border-info w-50"><span className="d-block small text-secondary">ROI</span><span className="fs-3 fw-bold text-info">{selectedOp.results.profitPercent.toFixed(2)}%</span></div>
                    </div>
                    <Table bordered size="sm" className="table-custom text-center mb-0"><tbody><tr><td className="text-secondary">Inversión</td><td className="fw-bold">{formatMoney(selectedOp.results.cost)}</td></tr><tr><td className="text-secondary">Retorno</td><td className="fw-bold">{formatMoney(selectedOp.results.revenue)}</td></tr>{selectedOp.transferFee > 0 && (<tr><td className="text-secondary">Costo Red</td><td className="text-danger fw-bold">-{formatMoney(selectedOp.transferFee)}</td></tr>)}</tbody></Table>
                </div>
            )}
        </Modal.Body>
      </Modal>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered className="modal-custom" backdrop="static">
        <Modal.Header closeButton className="close-btn-custom"><Modal.Title className="fw-bold text-warning">Editar Operación</Modal.Title></Modal.Header>
        <Modal.Body><CalculatorForm form={editForm} setForm={setEditForm} results={editResults} isEditMode={true} onSave={handleSaveOperation} onCancel={() => setShowEditModal(false)} theme={theme} /></Modal.Body>
      </Modal>
    </Container>
  );
};

export default ArbitrageDashboard;