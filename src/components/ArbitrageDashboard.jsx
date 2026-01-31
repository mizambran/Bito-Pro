import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Form, Table, Button, Badge, InputGroup, Pagination, Modal, Spinner 
} from 'react-bootstrap';
import { 
  Calculator, Save, Trash2, Edit, RefreshCw, TrendingUp, 
  ArrowRight, Moon, Sun, Eye, Clock, CheckCircle, FileSpreadsheet, Loader2 
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2'; // Importamos SweetAlert
import * as XLSX from 'xlsx';   // Importamos SheetJS para Excel
import '../App.css'; 

// --- GENERADOR DE DATOS SIMULADOS ---
const generateMockData = () => {
  return Array.from({ length: 30 }).map((_, i) => ({
    id: uuidv4(),
    pair: i % 2 === 0 ? 'BTC/USDT' : 'ETH/USDT',
    exchangeBuy: i % 3 === 0 ? 'Binance' : (i % 3 === 1 ? 'Kraken' : 'Bybit'),
    exchangeSell: i % 3 === 0 ? 'Kraken' : (i % 3 === 1 ? 'Bybit' : 'Binance'),
    buyPrice: 95000 + (Math.random() * 200),
    sellPrice: 95400 + (Math.random() * 200), 
    spread: 0, 
    type: i % 4 === 0 ? 'Triangular' : 'Espacial',
    isP2P: i % 5 === 0,
  })).map(item => ({
    ...item,
    spread: (((item.sellPrice - item.buyPrice) / item.buyPrice) * 100).toFixed(2)
  }));
};

const ArbitrageDashboard = () => {
  // --- ESTADOS ---
  const [theme, setTheme] = useState('dark');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [opportunities, setOpportunities] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Estado de carga general

  // Filtros
  const [filters, setFilters] = useState({
    currency: 'ALL',
    exchange: 'ALL',
    type: 'ALL',
    isP2P: false
  });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; 

  // Calculadora
  const [calcForm, setCalcForm] = useState({
    id: null, name: '', buyPrice: 0, sellPrice: 0, amount: 1, feeBuy: 0.1, feeSell: 0.1
  });

  // Datos guardados
  const [savedOperations, setSavedOperations] = useState([]);

  // Modal de Detalles
  const [showModal, setShowModal] = useState(false);
  const [selectedOp, setSelectedOp] = useState(null);

  // --- EFECTOS ---
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
  }, [theme]);

  useEffect(() => {
    setOpportunities(generateMockData());
    const stored = localStorage.getItem('bitoPro_operations');
    if (stored) setSavedOperations(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem('bitoPro_operations', JSON.stringify(savedOperations));
  }, [savedOperations]);


  // --- FUNCIONES AUXILIARES ---

  // Configuración de SweetAlert según el tema
  const swalConfig = {
    background: theme === 'dark' ? '#1e2329' : '#fff',
    color: theme === 'dark' ? '#eaecef' : '#1f2937',
    confirmButtonColor: '#0d6efd',
    cancelButtonColor: '#dc3545',
  };

  // 1. Refrescar Datos con Spinner
  const handleRefresh = () => {
    setIsLoading(true);
    // Simulamos petición a API
    setTimeout(() => {
      setOpportunities(generateMockData());
      setLastUpdated(new Date());
      setIsLoading(false);
      
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        ...swalConfig
      });
      Toast.fire({ icon: 'success', title: 'Datos actualizados' });
    }, 1200); // 1.2 segundos de "carga"
  };

  // 2. Exportar a Excel
  const handleExportExcel = () => {
    if (savedOperations.length === 0) {
        return Swal.fire({
            ...swalConfig,
            icon: 'info',
            title: 'Sin datos',
            text: 'No hay operaciones guardadas para exportar.'
        });
    }

    // Preparamos los datos planos para Excel
    const dataToExport = savedOperations.map(op => ({
        Nombre: op.name,
        Fecha: op.date,
        Par: 'BTC/USDT', // Podrías guardar el par en el objeto op también
        Compra_USD: op.buyPrice,
        Venta_USD: op.sellPrice,
        Volumen: op.amount,
        Inversion: op.results.cost,
        Ganancia_Neta: op.results.profit,
        ROI_Porcentaje: `${op.results.profitPercent.toFixed(2)}%`
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial_Arbitraje");
    XLSX.writeFile(wb, `BitoPro_Reporte_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    
    Swal.fire({
        ...swalConfig,
        icon: 'success',
        title: 'Exportado',
        text: 'El archivo Excel se ha descargado correctamente.'
    });
  };

  // 3. Filtros
  const filteredOpportunities = opportunities.filter(op => {
    if (filters.currency !== 'ALL' && !op.pair.includes(filters.currency)) return false;
    if (filters.exchange !== 'ALL') {
      const isInvolved = op.exchangeBuy === filters.exchange || op.exchangeSell === filters.exchange;
      if (!isInvolved) return false;
    }
    if (filters.type !== 'ALL' && op.type !== filters.type) return false;
    if (filters.isP2P && !op.isP2P) return false;
    return true;
  }).sort((a, b) => b.spread - a.spread);

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOpportunities.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);

  // Lógica de Calculadora
  const calculateResult = (form) => {
    const cost = form.amount * form.buyPrice * (1 + form.feeBuy / 100);
    const revenue = form.amount * form.sellPrice * (1 - form.feeSell / 100);
    const profit = revenue - cost;
    const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;
    return { cost, revenue, profit, profitPercent };
  };
  const currentResults = calculateResult(calcForm);

  // CRUD con SweetAlert
  const handleSaveOperation = () => {
    if (!calcForm.name) {
        return Swal.fire({ ...swalConfig, icon: 'warning', title: 'Falta información', text: 'Por favor, asigna un nombre a la operación.' });
    }
    
    const operationData = {
      ...calcForm,
      id: calcForm.id || uuidv4(),
      results: currentResults,
      date: new Date().toLocaleString()
    };

    if (calcForm.id) {
      setSavedOperations(prev => prev.map(op => op.id === calcForm.id ? operationData : op));
      Swal.fire({ ...swalConfig, icon: 'success', title: 'Actualizado', text: 'Operación editada correctamente.', timer: 1500, showConfirmButton: false });
    } else {
      setSavedOperations(prev => [operationData, ...prev]);
      // Preguntar si quiere ver detalles
      Swal.fire({
        ...swalConfig,
        icon: 'success',
        title: 'Guardado',
        text: 'La operación se registró en tu historial.',
        showCancelButton: true,
        confirmButtonText: 'Ver Detalles',
        cancelButtonText: 'Seguir Operando'
      }).then((result) => {
        if (result.isConfirmed) openModal(operationData);
      });
    }
    setCalcForm({ ...calcForm, id: null, name: '' });
  };

  const deleteOperation = (id) => {
    Swal.fire({
        ...swalConfig,
        title: '¿Estás seguro?',
        text: "No podrás revertir esta acción.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            setSavedOperations(prev => prev.filter(op => op.id !== id));
            Swal.fire({
                ...swalConfig,
                title: 'Borrado',
                text: 'La operación ha sido eliminada.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
  };

  const editOperation = (op) => {
    setCalcForm({
      id: op.id, name: op.name, buyPrice: op.buyPrice, sellPrice: op.sellPrice,
      amount: op.amount, feeBuy: op.feeBuy, feeSell: op.feeSell
    });
    document.getElementById('calculator-area').scrollIntoView({ behavior: 'smooth' });
  };

  const loadFromOpportunity = (op) => {
    setCalcForm(prev => ({
        ...prev,
        buyPrice: op.buyPrice,
        sellPrice: op.sellPrice,
        amount: 1, 
        name: `Arb ${op.pair} [${op.exchangeBuy} -> ${op.exchangeSell}]`
    }));
    document.getElementById('calculator-area').scrollIntoView({ behavior: 'smooth' });
  };

  const openModal = (op) => {
    const res = calculateResult(op); 
    setSelectedOp({ ...op, results: res });
    setShowModal(true);
  };

  // --- RENDER ---
  return (
    <Container fluid className="py-4 app-container min-vh-100">
      
      {/* HEADER */}
      <Row className="mb-4 align-items-center justify-content-between g-3">
        <Col md={4}>
          <h2 className={`fw-bold m-0 d-flex align-items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-dark'}`}>
            <TrendingUp className="text-warning" size={32} /> 
            Bito Pro 
            <Badge bg={theme === 'dark' ? 'secondary' : 'dark'} className="fw-normal fs-6">v1.3</Badge>
          </h2>
        </Col>

        <Col md={8} className="d-flex justify-content-md-end align-items-center gap-3 flex-wrap">
            <div className="d-flex align-items-center gap-2 text-secondary bg-card-custom px-3 py-2 rounded border border-secondary border-opacity-25">
                <Clock size={16} />
                <span className="small fw-semibold">
                    {lastUpdated.toLocaleTimeString()} 
                </span>
                <Button 
                    variant="link" 
                    className="p-0 text-primary ms-2" 
                    onClick={handleRefresh} 
                    disabled={isLoading}
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </Button>
            </div>
            <Button 
                variant={theme === 'dark' ? 'outline-light' : 'outline-dark'} 
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className="d-flex align-items-center gap-2 btn-sm"
            >
                {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
                {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
        </Col>
      </Row>

      {/* FILTROS */}
      <Card className="card-custom mb-4">
        <Card.Body>
          <Form>
            <Row className="g-3">
              <Col lg={3} md={6}>
                <Form.Label className="text-label">Moneda</Form.Label>
                <Form.Select className="form-control-custom" onChange={e => setFilters({...filters, currency: e.target.value})}>
                  <option value="ALL">Todas (BTC, ETH...)</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                </Form.Select>
              </Col>
              <Col lg={3} md={6}>
                <Form.Label className="text-label">Exchange</Form.Label>
                <Form.Select className="form-control-custom" onChange={e => setFilters({...filters, exchange: e.target.value})}>
                  <option value="ALL">Cualquiera</option>
                  <option value="Binance">Binance</option>
                  <option value="Kraken">Kraken</option>
                  <option value="Bybit">Bybit</option>
                </Form.Select>
              </Col>
              <Col lg={3} md={6}>
                <Form.Label className="text-label">Estrategia</Form.Label>
                <Form.Select className="form-control-custom" onChange={e => setFilters({...filters, type: e.target.value})}>
                  <option value="ALL">Todas</option>
                  <option value="Espacial">Espacial</option>
                  <option value="Triangular">Triangular</option>
                </Form.Select>
              </Col>
              <Col lg={3} md={6} className="d-flex align-items-end pb-2">
                <Form.Check 
                  type="switch"
                  id="p2p-switch"
                  label="Solo Mercado P2P"
                  className="fs-6 fw-bold text-secondary"
                  checked={filters.isP2P}
                  onChange={e => setFilters({...filters, isP2P: e.target.checked})}
                />
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {/* TABLA CON SPINNER DE CARGA */}
      <Card className="card-custom mb-4 overflow-hidden position-relative" style={{minHeight: '400px'}}>
        {isLoading && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-50" style={{zIndex: 10}}>
                <Spinner animation="border" variant="primary" style={{width: '3rem', height: '3rem'}} />
            </div>
        )}
        
        <Table hover responsive className="table-custom mb-0">
          <thead>
            <tr>
              <th>PAR</th>
              <th>COMPRA (LOW)</th>
              <th>VENTA (HIGH)</th>
              <th>SPREAD</th>
              <th>TIPO</th>
              <th className="text-end">ACCIÓN</th>
            </tr>
          </thead>
          <tbody style={{opacity: isLoading ? 0.3 : 1, transition: 'opacity 0.2s'}}>
            {currentItems.length > 0 ? currentItems.map((op) => (
              <tr key={op.id}>
                <td className="fw-bold">
                  {op.pair} 
                  {op.isP2P && <Badge bg="success" className="ms-2" style={{fontSize: '0.6rem'}}>P2P</Badge>}
                </td>
                <td>
                  <div className="text-danger fw-semibold">{op.exchangeBuy}</div>
                  <div className="small text-secondary">${op.buyPrice.toFixed(2)}</div>
                </td>
                <td>
                  <div className="text-success fw-semibold">{op.exchangeSell}</div>
                  <div className="small text-secondary">${op.sellPrice.toFixed(2)}</div>
                </td>
                <td className={`fw-bold ${parseFloat(op.spread) > 1.5 ? 'text-warning' : 'text-primary'}`}>
                    {op.spread}%
                </td>
                <td className="text-secondary small">{op.type}</td>
                <td className="text-end">
                  <Button variant="primary" size="sm" onClick={() => loadFromOpportunity(op)} className="d-inline-flex align-items-center gap-1">
                    <Calculator size={14} /> Calcular
                  </Button>
                </td>
              </tr>
            )) : (
                <tr><td colSpan="6" className="text-center py-4 text-muted">No hay oportunidades.</td></tr>
            )}
          </tbody>
        </Table>
        <Card.Footer className="bg-transparent border-top border-secondary d-flex justify-content-between align-items-center py-2">
            <span className="text-secondary small">Pag {currentPage} de {totalPages}</span>
            <Pagination className="mb-0" size="sm">
                <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} />
                <Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} />
            </Pagination>
        </Card.Footer>
      </Card>

      {/* CALCULADORA Y LISTA */}
      <Row className="g-4" id="calculator-area">
        {/* Calculadora */}
        <Col lg={7}>
          <Card className="card-custom h-100">
            <div className="card-header-custom d-flex justify-content-between align-items-center">
                <span className="text-warning fw-bold d-flex align-items-center gap-2">
                    <Calculator size={20}/> Calculadora
                </span>
                {calcForm.id && <Badge bg="info">Editando</Badge>}
            </div>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label className="text-label">Nombre de Referencia</Form.Label>
                  <Form.Control type="text" placeholder="Ej: Arb Tarde" className="form-control-custom"
                    value={calcForm.name} onChange={e => setCalcForm({...calcForm, name: e.target.value})}
                  />
                </Form.Group>

                <Row className="g-3 mb-3">
                    <Col md={6}>
                        <div className="p-3 rounded border border-danger border-opacity-25 bg-danger bg-opacity-10">
                            <h6 className="text-danger fw-bold mb-2"><ArrowRight size={16}/> COMPRA</h6>
                            <Row className="g-2">
                                <Col xs={7}>
                                    <span className="text-label d-block">Precio</span>
                                    <Form.Control type="number" size="sm" className="form-control-custom"
                                        value={calcForm.buyPrice} onChange={e => setCalcForm({...calcForm, buyPrice: parseFloat(e.target.value) || 0})}
                                    />
                                </Col>
                                <Col xs={5}>
                                    <span className="text-label d-block">Fee %</span>
                                    <Form.Control type="number" size="sm" className="form-control-custom"
                                        value={calcForm.feeBuy} onChange={e => setCalcForm({...calcForm, feeBuy: parseFloat(e.target.value) || 0})}
                                    />
                                </Col>
                            </Row>
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 rounded border border-success border-opacity-25 bg-success bg-opacity-10">
                            <h6 className="text-success fw-bold mb-2"><ArrowRight size={16}/> VENTA</h6>
                            <Row className="g-2">
                                <Col xs={7}>
                                    <span className="text-label d-block">Precio</span>
                                    <Form.Control type="number" size="sm" className="form-control-custom"
                                        value={calcForm.sellPrice} onChange={e => setCalcForm({...calcForm, sellPrice: parseFloat(e.target.value) || 0})}
                                    />
                                </Col>
                                <Col xs={5}>
                                    <span className="text-label d-block">Fee %</span>
                                    <Form.Control type="number" size="sm" className="form-control-custom"
                                        value={calcForm.feeSell} onChange={e => setCalcForm({...calcForm, feeSell: parseFloat(e.target.value) || 0})}
                                    />
                                </Col>
                            </Row>
                        </div>
                    </Col>
                </Row>

                <Row className="align-items-end g-3">
                    <Col md={6}>
                        <Form.Label className="text-label">Cantidad (Volumen)</Form.Label>
                        <Form.Control type="number" className="form-control-custom py-2 fw-bold"
                            value={calcForm.amount} onChange={e => setCalcForm({...calcForm, amount: parseFloat(e.target.value) || 0})}
                        />
                    </Col>
                    <Col md={6}>
                         <div className={`p-3 rounded border d-flex justify-content-between align-items-center ${theme === 'dark' ? 'border-secondary bg-black bg-opacity-25' : 'border-secondary bg-light'}`}>
                            <span className="text-secondary">Ganancia Neta:</span>
                            <span className={`fs-4 fw-bold ${currentResults.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                ${currentResults.profit.toFixed(2)}
                            </span>
                         </div>
                    </Col>
                </Row>
                <hr className="my-4 border-secondary"/>
                <Button variant={calcForm.id ? "info" : "success"} className="w-100 fw-bold" onClick={handleSaveOperation}>
                    <Save size={18} className="me-2"/> {calcForm.id ? 'Actualizar' : 'Guardar y Ver'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* LISTA DE GUARDADOS */}
        <Col lg={5}>
          <Card className="card-custom h-100">
            <div className="card-header-custom d-flex justify-content-between align-items-center">
                <span className="text-info fw-bold"><Save size={18} className="me-2 d-inline"/> Historial</span>
                <Button variant="outline-success" size="sm" onClick={handleExportExcel} title="Exportar a Excel">
                    <FileSpreadsheet size={16}/> Exportar
                </Button>
            </div>
            <Card.Body className="overflow-auto p-2" style={{maxHeight: '550px'}}>
              {savedOperations.length === 0 ? (
                <div className="text-center text-secondary py-5">Sin operaciones guardadas.</div>
              ) : (
                  savedOperations.map(op => (
                    <div key={op.id} className={`p-3 mb-2 rounded border d-flex justify-content-between align-items-center ${theme === 'dark' ? 'border-secondary bg-dark' : 'border-light bg-light'}`}>
                        <div>
                            <h6 className="mb-0 fw-bold text-primary">{op.name}</h6>
                            <span className={`fw-bold small ${op.results.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                {op.results.profitPercent.toFixed(2)}% ROI
                            </span>
                        </div>
                        <div className="d-flex gap-1">
                            <Button variant="link" className="p-1 text-info" onClick={() => openModal(op)}><Eye size={18}/></Button>
                            <Button variant="link" className="p-1 text-warning" onClick={() => editOperation(op)}><Edit size={18}/></Button>
                            <Button variant="link" className="p-1 text-danger" onClick={() => deleteOperation(op.id)}><Trash2 size={18}/></Button>
                        </div>
                    </div>
                  ))
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* MODAL DETALLES */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered className="modal-custom">
        <Modal.Header closeButton className="close-btn-custom">
            <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                <CheckCircle className="text-success"/> Detalles de Operación
            </Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {selectedOp && (
                <div className="px-2">
                    <h5 className="text-center mb-4 text-primary fw-bold">{selectedOp.name}</h5>
                    <div className="d-flex justify-content-center gap-4 mb-4">
                        <div className="text-center p-3 rounded bg-opacity-10 bg-success border border-success w-50">
                            <span className="d-block small text-secondary">Beneficio</span>
                            <span className="fs-3 fw-bold text-success">${selectedOp.results.profit.toFixed(2)}</span>
                        </div>
                        <div className="text-center p-3 rounded bg-opacity-10 bg-info border border-info w-50">
                            <span className="d-block small text-secondary">ROI</span>
                            <span className="fs-3 fw-bold text-info">{selectedOp.results.profitPercent.toFixed(2)}%</span>
                        </div>
                    </div>
                    <Table bordered size="sm" className="table-custom text-center mb-0">
                        <tbody>
                            <tr><td className="text-secondary">Inversión</td><td className="fw-bold">${selectedOp.results.cost.toFixed(2)}</td></tr>
                            <tr><td className="text-secondary">Retorno</td><td className="fw-bold">${selectedOp.results.revenue.toFixed(2)}</td></tr>
                        </tbody>
                    </Table>
                </div>
            )}
        </Modal.Body>
      </Modal>

    </Container>
  );
};

export default ArbitrageDashboard;